/**
 * Script de vérification des libellés en dur
 * 
 * Ce script recherche toutes les occurrences de strings en dur qui devraient utiliser i18n:
 * - "Mise en demeure" (devrait être "Chef à demeure" via i18n)
 * - "Prix global" (devrait être "Budget global" via i18n)
 * - "validée par" (devrait utiliser la clé booking.validation.clientValidated)
 * 
 * Usage: npx tsx scripts/check-labels.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

interface Match {
  file: string
  line: number
  content: string
  pattern: string
}

const patterns = [
  {
    pattern: /Mise en demeure/gi,
    description: '"Mise en demeure" (devrait utiliser booking.serviceType.mise_en_demeure)',
    exclude: ['messages/', 'node_modules/', '__tests__/', '.test.', '.spec.'],
  },
  {
    pattern: /Prix global/gi,
    description: '"Prix global" (devrait utiliser offer.budgetGlobalLabel)',
    exclude: ['messages/', 'node_modules/', '__tests__/', '.test.', '.spec.'],
  },
  {
    pattern: /validée par le client/gi,
    description: '"validée par le client" (devrait utiliser booking.validation.clientValidated)',
    exclude: ['messages/', 'node_modules/', '__tests__/', '.test.', '.spec.'],
  },
  {
    pattern: /validée par/gi,
    description: '"validée par" (devrait utiliser booking.validation.clientValidated)',
    exclude: ['messages/', 'node_modules/', '__tests__/', '.test.', '.spec.', 'validated_by_client'],
  },
]

const fileExtensions = ['.ts', '.tsx', '.js', '.jsx']
const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build']

function shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => filePath.includes(pattern))
}

function shouldExcludeDir(dirName: string): boolean {
  return excludeDirs.includes(dirName) || dirName.startsWith('.')
}

function findMatches(filePath: string, content: string, pattern: RegExp, description: string): Match[] {
  const matches: Match[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      // Vérifier que ce n'est pas un commentaire ou une chaîne de traduction
      const trimmedLine = line.trim()
      if (
        !trimmedLine.startsWith('//') &&
        !trimmedLine.startsWith('*') &&
        !trimmedLine.startsWith('/*') &&
        !line.includes('booking.serviceType') &&
        !line.includes('offer.budgetGlobalLabel') &&
        !line.includes('booking.validation')
      ) {
        matches.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          pattern: description,
        })
      }
    }
  })

  return matches
}

function scanDirectory(dirPath: string, basePath: string = ''): Match[] {
  const allMatches: Match[] = []
  const fullPath = basePath ? join(basePath, dirPath) : dirPath

  try {
    const entries = readdirSync(fullPath)

    for (const entry of entries) {
      const entryPath = join(fullPath, entry)
      const relativePath = basePath ? join(dirPath, entry) : entry

      try {
        const stats = statSync(entryPath)

        if (stats.isDirectory()) {
          if (!shouldExcludeDir(entry)) {
            allMatches.push(...scanDirectory(relativePath, basePath))
          }
        } else if (stats.isFile()) {
          const ext = extname(entry)
          if (fileExtensions.includes(ext)) {
            // Vérifier les patterns d'exclusion
            let shouldExclude = false
            for (const patternConfig of patterns) {
              if (shouldExcludeFile(relativePath, patternConfig.exclude)) {
                shouldExclude = true
                break
              }
            }

            if (!shouldExclude) {
              try {
                const content = readFileSync(entryPath, 'utf-8')
                for (const patternConfig of patterns) {
                  const matches = findMatches(relativePath, content, patternConfig.pattern, patternConfig.description)
                  allMatches.push(...matches)
                }
              } catch (error) {
                console.warn(`Erreur lors de la lecture de ${entryPath}:`, error)
              }
            }
          }
        }
      } catch (error) {
        // Ignorer les erreurs d'accès (permissions, etc.)
      }
    }
  } catch (error) {
    console.warn(`Erreur lors du scan de ${fullPath}:`, error)
  }

  return allMatches
}

function main() {
  console.log('🔍 Recherche des libellés en dur...\n')

  const projectRoot = process.cwd()
  const matches = scanDirectory('.', projectRoot)

  if (matches.length === 0) {
    console.log('✅ Aucun libellé en dur trouvé. Tous les textes utilisent i18n !\n')
    process.exit(0)
  }

  console.log(`⚠️  ${matches.length} occurrence(s) de libellés en dur trouvée(s):\n`)

  // Grouper par pattern
  const groupedMatches = new Map<string, Match[]>()
  matches.forEach((match) => {
    const key = match.pattern
    if (!groupedMatches.has(key)) {
      groupedMatches.set(key, [])
    }
    groupedMatches.get(key)!.push(match)
  })

  // Afficher les résultats groupés
  groupedMatches.forEach((matchList, pattern) => {
    console.log(`\n📌 ${pattern}:`)
    console.log(`   ${matchList.length} occurrence(s)\n`)

    matchList.forEach((match) => {
      console.log(`   📄 ${match.file}:${match.line}`)
      console.log(`      ${match.content}`)
      console.log('')
    })
  })

  console.log('\n💡 Suggestions:')
  console.log('   - Remplacer "Mise en demeure" par t("booking.serviceType.mise_en_demeure")')
  console.log('   - Remplacer "Prix global" par t("offer.budgetGlobalLabel")')
  console.log('   - Remplacer "validée par le client" par getValidationMessage(clientName)\n')

  process.exit(1)
}

main()
