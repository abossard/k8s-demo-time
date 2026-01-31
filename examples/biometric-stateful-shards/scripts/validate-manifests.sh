#!/usr/bin/env bash
set -euo pipefail

# validate-manifests.sh - Validate Kubernetes YAML manifests
# This script validates all manifests using kubeconform and kubectl

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"

echo "======================================"
echo "Kubernetes Manifest Validation"
echo "======================================"
echo ""

# Check if kubeconform is installed
if ! command -v kubeconform &> /dev/null; then
    echo "⚠️  kubeconform not found. Installing..."
    cd /tmp
    curl -sL https://github.com/yannh/kubeconform/releases/download/v0.6.4/kubeconform-linux-amd64.tar.gz -o kubeconform.tar.gz
    tar xf kubeconform.tar.gz
    sudo mv kubeconform /usr/local/bin/
    rm kubeconform.tar.gz
    echo "✅ kubeconform installed"
    echo ""
fi

echo "🔍 Validating base manifests..."
echo ""

# Validate base manifests (these should be complete, valid resources)
BASE_VALID=true
for file in "$K8S_DIR"/base/*.yaml; do
    echo "Checking $(basename "$file")..."
    RESULT=$(kubeconform -summary "$file" 2>&1)
    if echo "$RESULT" | grep -q "Invalid: 0, Errors: 0"; then
        echo "  ✅ Valid"
    else
        echo "  ❌ Invalid"
        kubeconform "$file"
        BASE_VALID=false
    fi
done

echo ""
echo "🔍 Validating overlay manifests (CRDs may not have schemas)..."
echo ""

# Validate explore overlay
echo "Explore overlay:"
for file in "$K8S_DIR"/overlays/explore/*.yaml; do
    filename=$(basename "$file")
    echo "  Checking $filename..."
    
    # Skip patches - they're not meant to be standalone valid
    if [[ "$filename" == *"patch"* ]]; then
        echo "    ⏭️  Skipped (patch file, not standalone resource)"
        continue
    fi
    
    # For CRDs (NodePool, VPA), we just check YAML syntax
    if [[ "$filename" == "nodepool.yaml" ]] || [[ "$filename" == "vpa.yaml" ]]; then
        if yamllint -d "{extends: default, rules: {line-length: {max: 120}}}" "$file" &>/dev/null; then
            echo "    ✅ YAML syntax valid (CRD, no schema validation)"
        else
            echo "    ❌ YAML syntax invalid"
            yamllint "$file"
            BASE_VALID=false
        fi
    else
        if kubeconform -summary "$file" 2>&1 | grep -q "Valid: 1"; then
            echo "    ✅ Valid"
        else
            echo "    ❌ Invalid"
            kubeconform "$file"
            BASE_VALID=false
        fi
    fi
done

echo ""
echo "Stable overlay:"
for file in "$K8S_DIR"/overlays/stable/*.yaml; do
    filename=$(basename "$file")
    echo "  Checking $filename..."
    
    # Skip patches
    if [[ "$filename" == *"patch"* ]]; then
        echo "    ⏭️  Skipped (patch file, not standalone resource)"
        continue
    fi
    
    # For NodePool CRD
    if [[ "$filename" == "nodepool.yaml" ]]; then
        if yamllint -d "{extends: default, rules: {line-length: {max: 120}}}" "$file" &>/dev/null; then
            echo "    ✅ YAML syntax valid (CRD, no schema validation)"
        else
            echo "    ❌ YAML syntax invalid"
            yamllint "$file"
            BASE_VALID=false
        fi
    else
        if kubeconform -summary "$file" 2>&1 | grep -q "Valid: 1"; then
            echo "    ✅ Valid"
        else
            echo "    ❌ Invalid"
            kubeconform "$file"
            BASE_VALID=false
        fi
    fi
done

echo ""
echo "======================================"
if [ "$BASE_VALID" = true ]; then
    echo "✅ All manifests validated successfully!"
    echo ""
    echo "Note:"
    echo "  - Patch files (*-patch.yaml) are strategic merge patches"
    echo "  - NodePool and VPA are CRDs validated for YAML syntax only"
    echo "  - For full validation, apply to a cluster with:"
    echo "    kubectl apply --dry-run=server -f k8s/base/"
else
    echo "❌ Some manifests have validation errors"
    echo ""
    exit 1
fi
echo "======================================"
echo ""
