# Android build toolchain

The committed Android build authority is:

- Gradle Wrapper **8.14.4** (`gradle/wrapper/gradle-wrapper.properties`)
- Android Gradle Plugin **8.13.1** (`build.gradle`)
- Kotlin Android plugin **2.2.0** (`build.gradle`)
- Android compile/target SDK **36**, minimum SDK **24** (`app/build.gradle`)
- **JDK 21** for governed local and CI builds

JDK 21 is the deliberate common runtime: AGP 8.13 requires at least JDK 17, while
Gradle 8.14 supports running on Java 21. Do not use JDK 25 with this wrapper.
Gradle's compatibility matrix does not support running Gradle on Java 25 until
Gradle 9.1.0. The Java/Kotlin bytecode target remains JVM 1.8 and is independent
of the JDK used to run Gradle.

Authoritative compatibility references:

- [AGP 8.13 release notes and compatibility](https://developer.android.com/build/releases/past-releases/agp-8-13-0-release-notes)
- [Gradle Java compatibility matrix](https://docs.gradle.org/8.14.4/userguide/compatibility.html#java_runtime)
- [Kotlin Gradle compatibility](https://kotlinlang.org/docs/gradle-configure-project.html#apply-the-plugin)

Set `JAVA_HOME` to a JDK 21 installation before invoking `gradlew` or
`gradlew.bat`. Android Studio's Gradle JDK setting must point to the same JDK.
Set the Android SDK location through the environment (`ANDROID_HOME`) or a
machine-local `local.properties`; `/android/local.properties` is intentionally
ignored and must not be committed.

The wrapper launchers and JAR were generated together with the Gradle 8.14.4
`wrapper` task. The apparently empty launcher classpath is expected: both
launchers use Java's `-jar` mode and directly execute
`gradle/wrapper/gradle-wrapper.jar`.
