#!/bin/bash
set -e

# Reusable helper: count files & lines for given find predicates
count_lines() {
	local label="$1"; shift
	# Build the base find with exclusions
	local base=(find . "$@" -not -path './.git/*' -not -path './__pycache__/*' -not -path './node_modules/*')
	local files lines
	files=$("${base[@]}" | wc -l)
	if [ "$files" -eq 0 ]; then
		lines=0
	else
		lines=$("${base[@]}" -exec wc -l {} \; | awk '{sum += $1} END {print sum+0}')
	fi
	echo "| $label | $files | $lines |" >> METRICS.generated.md
}

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

count_lines "Go" -name '*.go'
count_lines "Python" -name '*.py'
count_lines "YAML" \( -name '*.yaml' -o -name '*.yml' \)
count_lines "JSON" -name '*.json'
count_lines "Markdown" -name '*.md'
count_lines "Shell" -name '*.sh'
count_lines "Dockerfile" -name 'Dockerfile*'

echo "" >> METRICS.generated.md
echo "*Generated on $(date)*" >> METRICS.generated.md