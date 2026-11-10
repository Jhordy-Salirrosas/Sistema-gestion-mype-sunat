"""Measure new-code LCOV coverage against a Git base without changing CI gates."""
import json,re,subprocess,sys
from pathlib import Path
base=sys.argv[1] if len(sys.argv)>1 else subprocess.check_output(['git','merge-base','HEAD','origin/dev'],text=True).strip()
diff=subprocess.check_output(['git','diff','--unified=0',base,'--','src'],text=True)
changed={};path=None
for line in diff.splitlines():
 if line.startswith('+++ b/'):path=line[6:]
 elif line.startswith('@@'):
  m=re.search(r'\+(\d+)(?:,(\d+))?',line)
  start=int(m[1]);count=int(m[2] or 1)
  changed.setdefault(path,set()).update(range(start,start+count))
files={};path=None
for line in Path('coverage/lcov.info').read_text().splitlines():
 if line.startswith('SF:'):
  path=line[3:];path=str(Path(path).relative_to(Path.cwd())) if Path(path).is_absolute() else path
  files[path]={'lines':{},'branches':{}}
 elif line.startswith('DA:'):
  n,hits,*_=line[3:].split(',');files[path]['lines'][int(n)]=int(hits)
 elif line.startswith('BRDA:'):
  n,block,branch,hits=line[5:].split(',');files[path]['branches'][(int(n),block,branch)]=0 if hits=='-' else int(hits)
rows=[]
for path,lines in changed.items():
 if '/generated/' in path or path not in files:continue
 f=files[path];el=[hits for n,hits in f['lines'].items() if n in lines];conditions=[hits for (n,*_),hits in f['branches'].items() if n in lines]
 if el or conditions:rows.append({'file':path,'lines_to_cover':len(el),'covered_lines':sum(h>0 for h in el),'conditions_to_cover':len(conditions),'covered_conditions':sum(h>0 for h in conditions)})
totals={k:sum(r[k] for r in rows) for k in ['lines_to_cover','covered_lines','conditions_to_cover','covered_conditions']}
totals['line_coverage_pct']=round(100*totals['covered_lines']/totals['lines_to_cover'],2) if totals['lines_to_cover'] else None
denominator=totals['lines_to_cover']+totals['conditions_to_cover']
totals['combined_coverage_pct']=round(100*(totals['covered_lines']+totals['covered_conditions'])/denominator,2) if denominator else None
print(json.dumps({'base':base,'method':'git diff added lines intersected with LCOV DA/BRDA; combined=(covered lines+covered condition outcomes)/(lines to cover+condition outcomes)','totals':totals,'files':rows},indent=2))
