package io.tteonaljido.car

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The core module hands every finding's arguments over as strings (`Issue.args`, `Change.args`, `NextStep.noteArgs`),
 * so a `%d` in a template that `Localize.kt` maps to one of those codes would throw at render time. Also keeps the two
 * languages' keys and placeholder sets identical. Plain JVM test: it reads the source tree.
 */
class StringsFormatTest {
    private val module = sequenceOf(File("."), File("app"), File("car/app")).first { File(it, "src/main/res/values/strings.xml").isFile }
    private val entry = Regex("""<string name="([a-z0-9_]+)">(.*?)</string>""", RegexOption.DOT_MATCHES_ALL)
    private val placeholder = Regex("""%(\d+)\$([sd])""")

    private fun strings(dir: String): Map<String, String> =
        entry.findAll(File(module, "src/main/res/$dir/strings.xml").readText()).associate { it.groupValues[1] to it.groupValues[2] }

    /** The templates that receive string arguments: every `R.string.x` referenced from Localize.kt. */
    private fun codedKeys(): Set<String> =
        Regex("""R\.string\.([a-z0-9_]+)""").findAll(File(module, "src/main/java/io/tteonaljido/car/ui/Localize.kt").readText()).map { it.groupValues[1] }.toSet()

    @Test fun codedFindingsOnlyUseStringPlaceholders() {
        val keys = codedKeys()
        assertTrue("Localize.kt should map codes to strings", keys.size > 20)
        for (dir in listOf("values", "values-en")) {
            val bad = strings(dir).filter { (k, v) -> k in keys && placeholder.findAll(v).any { it.groupValues[2] == "d" } }
            assertTrue("$dir: %d in a template that receives string args: ${bad.keys}", bad.isEmpty())
        }
    }

    @Test fun bothLanguagesHaveTheSameKeysAndPlaceholders() {
        val ko = strings("values")
        val en = strings("values-en")
        assertEquals("keys", ko.keys, en.keys)
        for ((k, v) in ko) {
            val a = placeholder.findAll(v).map { it.groupValues[1] + it.groupValues[2] }.toSortedSet()
            val b = placeholder.findAll(en.getValue(k)).map { it.groupValues[1] + it.groupValues[2] }.toSortedSet()
            assertEquals("placeholders of $k", a, b)
        }
    }
}
