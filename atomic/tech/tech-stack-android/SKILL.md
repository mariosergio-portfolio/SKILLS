---
name: tech-stack-android
description: Use when the user invokes %tech-stack-android or asks about building an Android app with Kotlin, Jetpack Compose, Clean Architecture + MVVM, Hilt, Room, Retrofit, Coroutines, and WorkManager.
---

# Android Stack — Kotlin + Compose + Clean Architecture + MVVM

## When to use this skill
Activate when the user types `%tech-stack-android` or needs guidance on the Android technology stack: Kotlin, Jetpack Compose, Clean Architecture + MVVM, Hilt DI, Room, Retrofit, Coroutines/Flow, and WorkManager.

---

## Technology Stack

| Concern | Technology | Notes |
|---------|------------|-------|
| Language | **Kotlin** | No Java source files; use Kotlin idioms throughout |
| UI | **Jetpack Compose** | No XML layouts; all UI built with `@Composable` functions |
| Architecture | **Clean Architecture + MVVM** | Three layers: Domain, Data, Presentation |
| Dependency Injection | **Hilt** (`com.google.dagger:hilt-android`) | `@HiltViewModel`, `@Inject constructor`, `@Module`/`@Provides` |
| Networking | **Retrofit 2 + Kotlin Serialization** | `kotlinx.serialization` for JSON; no Gson/Moshi |
| Database | **Room** (`androidx.room`) | Offline persistence; `@Entity`, `@Dao`, `@Database` |
| Async | **Coroutines + Flow** | `viewModelScope`, `StateFlow`, `collectAsStateWithLifecycle` |
| Images | **Coil** (`io.coil-kt:coil-compose`) | `AsyncImage` composable |
| Navigation | **Navigation Compose** (`androidx.navigation:navigation-compose`) | Type-safe routes with `@Serializable` data classes |
| Camera / File | Jetpack `ActivityResultContracts` | `TakePicture`, `GetContent` |
| Date picker | Material3 `DatePicker` composable | |
| Background sync | **WorkManager** | Push pending data when connectivity is restored |
| Build | Gradle (Kotlin DSL `.kts`) + Version Catalog (`libs.versions.toml`) | `compileSdk 36`, `minSdk 26` |
| Testing | JUnit 5 + MockK + Turbine + Compose UI Test | Unit, ViewModel, and Compose layer tests |

---

## Architecture — Clean Architecture + MVVM

Three concentric layers; inner layers have no dependency on outer ones.

```
┌─────────────────────────────────────────────┐
│             PRESENTATION LAYER               │
│  View (Compose screens)                      │
│  ViewModel — StateFlow<UiState>              │
│              SharedFlow<UiEvent>             │
└──────────────────────┬──────────────────────┘
                       │ calls use cases
┌──────────────────────▼──────────────────────┐
│               DOMAIN LAYER                   │
│  Use Cases · Model classes                   │
│  Repository interfaces (contracts)           │
│  Pure Kotlin — no Android/framework deps     │
└──────────────────────┬──────────────────────┘
                       │ implemented by
┌──────────────────────▼──────────────────────┐
│                DATA LAYER                    │
│  Repository implementations                 │
│  Room (local): entities, DAOs               │
│  Retrofit (remote): API service, DTOs       │
│  Mappers: Entity/DTO ↔ Domain model         │
└─────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Contents | Rules |
|-------|----------|-------|
| **Domain** | Plain Kotlin model classes, use-case classes, repository interfaces | No Android, Room, Retrofit, Hilt, or Compose imports |
| **Data** | Repository implementations, Room entities/DAOs, Retrofit API service/DTOs, mappers, `AppDatabase`, DI modules | Implements domain repository interfaces; never exposes Room entities or DTOs outside this layer |
| **Presentation** | `@HiltViewModel` ViewModels, `@Composable` screens, shared composables, theme, navigation | ViewModels call use cases; screens observe `StateFlow<UiState>`; no direct data-layer access from screens |

---

## Conventions & Patterns

### Domain layer
- Plain Kotlin **data classes** and **sealed classes/interfaces** — zero framework imports.
- Use-case classes have a single public `operator fun invoke(…): Flow<T>` or `suspend fun invoke(…): Result<T>`.
- Repository interfaces define the contract; implementations live in the Data layer.

### Data layer
- **Room entities** (`{Entity}Entity`) and **DTOs** (`{Entity}Dto`) are never exposed outside this layer.
- DTOs annotated with `@Serializable`; configure Retrofit with `kotlinx.serialization` converter (`com.jakewharton.retrofit2:retrofit2-kotlinx-serialization-converter`).
- **Mapper functions** (extension functions or objects in `data/mapper/`) own all conversion between entities/DTOs and domain models.
- Repository implementations inject DAOs and the API service via constructor; call mappers before returning domain models.
- Use `@Transaction` for multi-table Room writes.
- `SyncWorker` (WorkManager) reads `PENDING` records, POSTs to the API, and updates `syncStatus`.

### Presentation — ViewModel
- Annotate with `@HiltViewModel`; inject **use-case** classes via constructor (never repositories directly).
- Expose a single `val uiState: StateFlow<UiState>` per ViewModel.
- `UiState` is an immutable **data class** — a complete snapshot of what the screen should render.
- Side-effects (navigation, snackbars) emitted via a `SharedFlow<UiEvent>`.
- All coroutine work runs in `viewModelScope`; no blocking calls.
- ViewModels have **no** Compose, Android UI, or data-layer imports.

### Presentation — Compose screens
- Each screen is a top-level `@Composable` accepting `UiState` + lambda callbacks; deep composables never hold a ViewModel reference.
- Use `collectAsStateWithLifecycle()` (from `lifecycle-runtime-compose`) — never `collectAsState()` alone.
- Use **Coil** `AsyncImage` for all image display.
- All theme tokens through `MaterialTheme` (`colorScheme`, `typography`).
- Provide `@Preview` for every non-trivial composable.
- Use `LazyColumn`/`LazyRow` for lists; avoid nested scrollables.

### Kotlin idioms
- **Sealed interfaces** for discriminated types — exhaustive `when` expressions.
- `Result<T>` for use-case returns; map to `UiState` in the ViewModel.
- Constructor injection everywhere; no service-locator patterns.
- No Java source files.

### Naming

| Artefact | Convention | Example |
|----------|------------|---------|
| Domain model | plain name | `Order`, `Customer` |
| Repository interface | `{Entity}Repository` | `OrderRepository` |
| Repository impl | `{Entity}RepositoryImpl` | `OrderRepositoryImpl` |
| Use case | `{Action}{Entity}UseCase` | `CreateOrderUseCase` |
| Room entity | `{Entity}Entity` | `OrderEntity` |
| DAO | `{Entity}Dao` | `OrderDao` |
| DTO | `{Entity}Dto` | `OrderRequestDto` |
| Mapper | `{Entity}Mapper` | `OrderMapper` |
| ViewModel | `{Screen}ViewModel` | `OrderViewModel` |
| UiState | `{Screen}UiState` | `OrderUiState` |
| UiEvent | `{Screen}UiEvent` | `OrderUiEvent` |
| Screen composable | `{Screen}Screen` | `OrderScreen` |

---

## Project Structure (canonical)

```
app/
├── domain/
│   ├── model/          ← Pure Kotlin data/sealed classes
│   ├── repository/     ← Repository interfaces (contracts)
│   └── usecase/        ← One class per operation
│
├── data/
│   ├── local/          ← Room: AppDatabase, entities, DAOs
│   ├── remote/         ← Retrofit: API service interface, DTOs
│   ├── repository/     ← Repository implementations
│   ├── mapper/         ← Entity/DTO ↔ Domain model mappers
│   └── worker/         ← WorkManager workers
│
├── di/                 ← Hilt @Module classes
│   ├── DatabaseModule.kt
│   ├── NetworkModule.kt
│   └── RepositoryModule.kt
│
├── presentation/
│   ├── navigation/     ← NavHost, type-safe route definitions
│   ├── <feature>/      ← {Screen}Screen.kt, {Screen}ViewModel.kt, {Screen}UiState.kt
│   └── shared/         ← Reusable composables, theme
│
└── util/
```

---

## Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Domain use cases | JUnit 5 + MockK | Unit tests; repository interfaces mocked |
| Data / Repository | JUnit 5 + MockK + in-memory Room | Integration tests for persistence |
| ViewModel | JUnit 5 + MockK + Turbine | `UiState` emissions and `UiEvent` flows |
| Compose UI | Compose UI Test (`createComposeRule`) | Screen rendering and interactions |
| Remote / Sync | MockWebServer (OkHttp) | Retrofit + Kotlin Serialization integration tests |

---

## How to use this skill
1. Apply this stack, architecture, and conventions to any Kotlin Android project.
2. Respond and assist in English unless the user requests another language.
3. Await further instructions from the user and execute them accordingly.
