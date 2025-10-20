# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /source

COPY NuGet.config ./
COPY src/K8sDemoApp/*.csproj ./K8sDemoApp/
RUN dotnet restore K8sDemoApp/K8sDemoApp.csproj

COPY src/K8sDemoApp/. ./K8sDemoApp/
WORKDIR /source/K8sDemoApp
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "K8sDemoApp.dll"]
