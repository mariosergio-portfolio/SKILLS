---
name: tech-stack-android
description: Native Android stack: Kotlin, Jetpack Compose, Clean Architecture + MVVM, Hilt, Room, Retrofit, Coroutines/Flow and WorkManager, with Gradle version catalog and SDK targets, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or building or structuring an Android app.
---

# Android Stack — Kotlin + Compose + Clean Architecture + MVVM

## Technology Stack

> **Version pins — last verified: (not recorded; write the YYYY-MM here when you check them).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

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

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table (and its reference files). Don't pull "latest" from memory or from a generator, and if a generator writes different versions, change them to the table's.
- Scaffold the skeleton only: build files, layout, configuration, a health check, and one smoke test. Add no example domain code, sample entities or database migrations unless asked.
- If a required tool is missing (JDK, Maven, Gradle, .NET SDK, Node, Android SDK), say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

**Inputs:** app name (e.g. `Shop`) · application id / package (e.g. `com.mycompany.shop`).

1. **Gradle.** Write `settings.gradle.kts`, the root and `app/` `build.gradle.kts`, and `gradle/libs.versions.toml` with every library from the Technology Stack table in the version catalog. Set `compileSdk 36` and `minSdk 26`, and add the Compose, Hilt (KSP) and Kotlin serialization plugins. Generate the Gradle wrapper.
2. **App shell.** An `@HiltAndroidApp` `Application` class, a `MainActivity` with `setContent` and the Material3 theme, and a `NavHost` with a single placeholder route (type-safe `@Serializable` route).
3. **Layout.** Create the Project Structure folders (`domain/`, `data/local|remote|repository|mapper|worker/`, `di/`, `presentation/`, `util/`), with empty Hilt modules in `di/` and `.gitkeep` where needed.
4. **Manifest.** Declare the application class, `INTERNET` permission, and no cleartext traffic.
5. **Tests.** One JUnit 5 unit test, and one Compose UI test that the placeholder screen renders.
6. **Repo files.** `.gitignore` (build/, .gradle/, `local.properties`, keystores), and a `README.md`.
7. **Verify.** Run `./gradlew assembleDebug testDebugUnitTest`. The instrumented Compose UI test needs a device or emulator; if none is available, report it as not verified.

## Done criteria (new project)

- [ ] `assembleDebug` and the unit tests are green. UI tests are green or reported as not verified.
- [ ] Every dependency version lives only in `libs.versions.toml` and matches this skill's table.
- [ ] Hilt is wired: the app launches to the placeholder screen without crashing (checked on an emulator if one is available).
- [ ] No keystores, API keys or `local.properties` are committed.
