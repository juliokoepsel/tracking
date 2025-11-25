#!/bin/bash

# Generate STRUCTURE.generated.md
echo "# Project Structure" > STRUCTURE.generated.md
echo "" >> STRUCTURE.generated.md
echo '```' >> STRUCTURE.generated.md
# Prefer 'tree' for accurate hierarchy; fallback to awk-based rendering
if command -v tree >/dev/null 2>&1; then
	# Exclude common noise directories and omit summary
	tree -I '.git|__pycache__|node_modules' --noreport >> STRUCTURE.generated.md
else
	# Build a sorted unified list (dirs first with trailing '/') and render with indentation
	{
		find . -type d -not -path './.git*' -not -path './__pycache__*' -not -path './node_modules*' \
			| sed 's|^\./||; s|$|/|'
		find . -type f -not -path './.git*' -not -path './__pycache__*' -not -path './node_modules*' \
			| sed 's|^\./||'
	} | LC_ALL=C sort \
		| awk '
				{
					path=$0
					# Determine if directory (ends with /)
					isdir = (path ~ /\/$/)
					# Remove trailing slash for depth/name calc
					p=path; sub(/\/$/, "", p)
					# Handle root entries
					n=split(p, parts, "/")
					indent=(p==""?0:n-1)
					name=parts[n]
					pad=""
					for(i=0;i<indent;i++) pad=pad "  "
					print pad "- " name (isdir?"/":"")
				}
			' >> STRUCTURE.generated.md
fi
echo '```' >> STRUCTURE.generated.md

# Generate METRICS.generated.md
echo "# Project Metrics" > METRICS.generated.md
echo "" >> METRICS.generated.md

# File counts by extension
echo "## File Counts by Type" >> METRICS.generated.md
echo "" >> METRICS.generated.md
echo "| Extension | Count |" >> METRICS.generated.md
echo "|-----------|-------|" >> METRICS.generated.md
find . -type f -not -path './.git/*' -not -path './__pycache__/*' -not -path './node_modules/*' \
	| awk -F/ '{
			f=$NF;
			if (f ~ /^[^.].*\.[^.]+$/) {
				n=split(f, a, ".");
				print a[n];
			}
		}' \
	| sort | uniq -c | sort -nr \
	| awk '{print "| ." $2 " | " $1 " |"}' >> METRICS.generated.md

echo "" >> METRICS.generated.md

# Total lines of code (approximate)
echo "## Lines of Code (Approximate)" >> METRICS.generated.md
echo "" >> METRICS.generated.md
echo "| Language | Files | Lines |" >> METRICS.generated.md
echo "|----------|-------|-------|" >> METRICS.generated.md

# Go
GO_FILES=$(find . -name '*.go' -not -path './.git/*' | wc -l)
GO_LINES=$(find . -name '*.go' -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| Go | $GO_FILES | $GO_LINES |" >> METRICS.generated.md

# Python
PY_FILES=$(find . -name '*.py' -not -path './.git/*' -not -path './__pycache__/*' | wc -l)
PY_LINES=$(find . -name '*.py' -not -path './.git/*' -not -path './__pycache__/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| Python | $PY_FILES | $PY_LINES |" >> METRICS.generated.md

# YAML
YAML_FILES=$(find . \( -name '*.yaml' -o -name '*.yml' \) -not -path './.git/*' | wc -l)
YAML_LINES=$(find . \( -name '*.yaml' -o -name '*.yml' \) -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| YAML | $YAML_FILES | $YAML_LINES |" >> METRICS.generated.md

# JSON
JSON_FILES=$(find . -name '*.json' -not -path './.git/*' | wc -l)
JSON_LINES=$(find . -name '*.json' -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| JSON | $JSON_FILES | $JSON_LINES |" >> METRICS.generated.md

# Markdown
MD_FILES=$(find . -name '*.md' -not -path './.git/*' | wc -l)
MD_LINES=$(find . -name '*.md' -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| Markdown | $MD_FILES | $MD_LINES |" >> METRICS.generated.md

# Shell
SH_FILES=$(find . -name '*.sh' -not -path './.git/*' | wc -l)
SH_LINES=$(find . -name '*.sh' -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| Shell | $SH_FILES | $SH_LINES |" >> METRICS.generated.md

# Dockerfile
DOCKER_FILES=$(find . -name 'Dockerfile*' -not -path './.git/*' | wc -l)
DOCKER_LINES=$(find . -name 'Dockerfile*' -not -path './.git/*' -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
echo "| Dockerfile | $DOCKER_FILES | $DOCKER_LINES |" >> METRICS.generated.md

echo "" >> METRICS.generated.md
echo "*Generated on $(date)*" >> METRICS.generated.md