import { Router } from 'express';
import {
  createDeck, getDeck, listDecks, updateDeck, deleteDeck,
  setCurriculumItems, getCurriculumItems,
  createSlideRecords, getFullDeck,
  writeSlideContent, updateSlideStatus,
  type CurriculumItem, type VisualType,
} from '../services/deck-manager.js';
import { generateCurriculum } from '../services/curriculum-generator.js';
import { generateSlideFromCurriculum, regenerateSlide } from '../services/slide-generator.js';
import { scanDirectory, readFileContent } from '../services/scanner.js';
import { parseK8sYaml, generateMermaidDiagram } from '../utils/k8s-yaml.js';
import { initSSE } from '../utils/sse.js';
import { createHash } from 'crypto';
import path from 'path';

export const decksRouter = Router();

function computeHash(...contents: string[]): string {
  return createHash('sha256').update(contents.join('\n---\n')).digest('hex').slice(0, 16);
}

// ---- List all decks ----
decksRouter.get('/', (_req, res) => {
  res.json(listDecks());
});

// ---- Create deck + generate curriculum ----
decksRouter.post('/', async (req, res) => {
  const { readmePath } = req.body as {
    readmePath: string;
  };

  if (!readmePath) {
    res.status(400).json({ error: 'readmePath is required' });
    return;
  }

  const send = initSSE(res);

  try {
    send('progress', { step: 'scan', detail: 'Scanning files...' });
    const content = await readFileContent(readmePath);
    const basePath = path.dirname(readmePath);
    const scanResult = await scanDirectory(basePath);

    send('progress', { step: 'scan', detail: `Found ${scanResult.readmeFiles.length} READMEs, ${scanResult.yamlFiles.length} YAML files` });

    const yamlResources = [];
    for (let i = 0; i < scanResult.yamlFiles.length; i++) {
      try {
        const yamlContent = await readFileContent(scanResult.yamlFiles[i]!);
        const resources = parseK8sYaml(yamlContent, scanResult.yamlFiles[i]!);
        yamlResources.push(...resources);
      } catch {}
      if ((i + 1) % 5 === 0) {
        send('progress', { step: 'yaml', detail: `Parsed ${i + 1}/${scanResult.yamlFiles.length} YAML files (${yamlResources.length} resources)` });
      }
    }

    send('progress', { step: 'yaml', detail: `Found ${yamlResources.length} K8s resources from ${scanResult.yamlFiles.length} files` });

    const contentHash = computeHash(content);

    send('progress', { step: 'ai', detail: 'AI is analyzing content and building curriculum...' });
    const outline = await generateCurriculum(content, yamlResources, 'intermediate');

    send('progress', { step: 'save', detail: `Curriculum ready: ${outline.items.length} slides planned` });

    // Create deck in DB
    const deck = createDeck(readmePath, outline.title);
    updateDeck(deck.id, { content_hash: contentHash });

    // Store curriculum items
    const items = outline.items.map((item, i) => ({
      order_num: i + 1,
      title: item.title,
      subtitle: item.subtitle ?? null,
      covered_section: item.coveredSection ?? null,
      visual_types: (item.visualTypes ?? []) as VisualType[],
      command_count: item.commandCount,
      user_notes: null,
      approved: true,
    }));

    const savedItems = setCurriculumItems(deck.id, items);

    send('complete', {
      deck: getDeck(deck.id),
      curriculum: savedItems,
      description: outline.description,
    });
  } catch (err: any) {
    send('error', { message: err.message });
  }

  res.end();
});

// ---- Get deck with full data ----
decksRouter.get('/:id', async (req, res) => {
  try {
    const full = await getFullDeck(req.params['id']!);
    if (!full) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // Also get YAML resources for architecture tab
    const basePath = path.dirname(full.deck.readme_path);
    const scanResult = await scanDirectory(basePath);
    const yamlResources = [];
    for (const yamlPath of scanResult.yamlFiles) {
      try {
        const yamlContent = await readFileContent(yamlPath);
        yamlResources.push(...parseK8sYaml(yamlContent, yamlPath));
      } catch {}
    }
    const mermaidDiagram = yamlResources.length > 0 ? generateMermaidDiagram(yamlResources) : null;

    res.json({ ...full, yamlFiles: yamlResources, mermaidDiagram });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Delete deck ----
decksRouter.delete('/:id', (_req, res) => {
  deleteDeck(_req.params['id']!);
  res.json({ success: true });
});

// ---- Update curriculum ----
decksRouter.put('/:id/curriculum', (req, res) => {
  const deckId = req.params['id']!;
  const { items } = req.body as { items: Omit<CurriculumItem, 'id' | 'deck_id'>[] };

  if (!items) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  const saved = setCurriculumItems(deckId, items);
  updateDeck(deckId, { status: 'curriculum_approved' });
  res.json({ curriculum: saved });
});

// ---- Generate slides from approved curriculum (SSE) ----
decksRouter.post('/:id/generate', async (req, res) => {
  const deckId = req.params['id']!;
  const deck = getDeck(deckId);

  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const send = initSSE(res);

  try {
    updateDeck(deckId, { status: 'generating' });

    const content = await readFileContent(deck.readme_path);
    const curriculum = getCurriculumItems(deckId);
    const approvedItems = curriculum.filter(c => c.approved);

    // Create slide records (pending)
    const slideRecords = createSlideRecords(deckId, approvedItems);
    const totalSlides = slideRecords.length;
    const startTime = Date.now();

    send('progress', {
      detail: `Generating ${totalSlides} slides...`,
      total: totalSlides,
      completed: 0,
      elapsed: 0,
    });

    // Generate slides in parallel batches of 3
    const BATCH_SIZE = 3;
    let completedCount = 0;

    for (let batchStart = 0; batchStart < slideRecords.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, slideRecords.length);
      const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, j) => batchStart + j);

      // Notify start for all slides in this batch
      for (const i of batchIndices) {
        send('slide_start', {
          index: i,
          total: totalSlides,
          title: approvedItems[i]!.title,
          visualTypes: approvedItems[i]!.visual_types,
          elapsed: Date.now() - startTime,
        });
        updateSlideStatus(slideRecords[i]!.id, 'generating');
      }

      // Generate batch concurrently
      const batchResults = await Promise.allSettled(
        batchIndices.map(async (i) => {
          const record = slideRecords[i]!;
          const currItem = approvedItems[i]!;
          const slideStart = Date.now();

          // No token streaming for parallel generation — faster
          const slideContent = await generateSlideFromCurriculum(
            currItem, content, 'intermediate', i, totalSlides,
          );
          slideContent.id = record.id;
          await writeSlideContent(record.id, slideContent);

          return { index: i, slideContent, duration: ((Date.now() - slideStart) / 1000).toFixed(1) };
        }),
      );

      // Report results for this batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { index, slideContent, duration } = result.value;
          completedCount++;
          send('slide_complete', {
            index,
            total: totalSlides,
            title: slideContent.title,
            visualType: slideContent.visuals?.[0]?.type ?? 'none',
            slide: slideContent,
            duration,
            tokenCount: 0,
            elapsed: Date.now() - startTime,
            completed: completedCount,
          });
        } else {
          // Find which index failed
          const failedIndex = batchIndices[batchResults.indexOf(result)]!;
          updateSlideStatus(slideRecords[failedIndex]!.id, 'error');
          send('slide_error', {
            index: failedIndex,
            total: totalSlides,
            title: approvedItems[failedIndex]!.title,
            error: result.reason?.message ?? 'Unknown error',
            elapsed: Date.now() - startTime,
            completed: completedCount,
          });
        }
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    updateDeck(deckId, { status: 'ready' });
    send('done', { deckId, totalDuration, totalSlides });
  } catch (err: any) {
    updateDeck(deckId, { status: 'error' });
    send('error', { message: err.message });
  }

  res.end();
});

// ---- Regenerate single slide ----
decksRouter.post('/:id/slides/:slideId/regenerate', async (req, res) => {
  const { id: deckId, slideId } = req.params as { id: string; slideId: string };
  const { feedback } = req.body as { feedback?: string };

  const deck = getDeck(deckId);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  try {
    const content = await readFileContent(deck.readme_path);
    const full = await getFullDeck(deckId);
    const currentSlide = full?.slides.find(s => s.id === slideId);

    if (!currentSlide) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    updateSlideStatus(slideId, 'generating');
    const newSlide = await regenerateSlide(currentSlide, content, 'intermediate', feedback);
    newSlide.id = slideId;
    await writeSlideContent(slideId, newSlide);

    res.json({ slide: newSlide });
  } catch (err: any) {
    updateSlideStatus(slideId, 'error');
    res.status(500).json({ error: err.message });
  }
});
