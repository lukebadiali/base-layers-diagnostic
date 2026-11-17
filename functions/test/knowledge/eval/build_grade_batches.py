# Builds out/grade-batches/batch{1..5}.json from out/results.json for the
# Claude sub-agent graders. Each source carries the session date and attendees
# line so names and job titles are not flagged as unsupported.
# Usage: python3 -I build_grade_batches.py <path to functions/test/knowledge/eval>
import json, os, sys
E = sys.argv[1]  # eval dir
SPECS = os.path.join(E, "data/specs"); OUT = os.path.join(E, "out")
V2 = {f.replace("__v2.content.json", "") for f in os.listdir(SPECS) if f.endswith("__v2.content.json")}

def one(client, pillar, v2):
    stem = f"{client}__p{pillar}" + ("__v2" if v2 else "")
    spec = json.load(open(os.path.join(SPECS, stem + ".json")))
    head = f"Session date: {spec.get('0,2,1','')}\nAttendees: {spec.get('0,4,1','').replace(chr(10), '; ')}"
    return head + "\n" + open(os.path.join(SPECS, stem + ".content.json")).read()

def source(client, pillar):
    if not pillar: return "(no form: this question is not covered by any session)"
    if f"{client}__p{pillar}" in V2:
        return f"EARLIER form (superseded):\n{one(client, pillar, False)}\n\nCURRENT form:\n{one(client, pillar, True)}"
    return one(client, pillar, False)

res = json.load(open(os.path.join(OUT, "results.json")))["results"]
items = [{"id": r["id"], "kind": r["kind"], "question": r["question"], "expectedFacts": r["expectedFacts"],
          "oldPositions": r.get("forbiddenFacts", []), "answer": r["answer"] if not r.get("error") else f"(ERROR: {r['error']})",
          "source": source(r["client"], r["pillar"])} for r in res]
d = os.path.join(OUT, "grade-batches"); os.makedirs(d, exist_ok=True)
n = 5; size = -(-len(items) // n)
for k in range(n):
    json.dump(items[k*size:(k+1)*size], open(os.path.join(d, f"batch{k+1}.json"), "w"), indent=1, ensure_ascii=False)
    print(k+1, len(items[k*size:(k+1)*size]))
