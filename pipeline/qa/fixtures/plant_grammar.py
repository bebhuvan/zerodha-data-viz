"""Build planted_grammar.svg: a real chart (state_ranked, instagram_portrait) with six grammar defects.
Usage: python3 -I plant_grammar.py <path to a rendered instagram_portrait/state_ranked.svg>
Expected: node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_grammar.svg -> exactly 6 [grammar] issues:
  1 type role   "Lakshadweep" set 20px 600 grey (no role is small, semibold and grey)
  2 tabular     a planted chart number with proportional figures
  3 ink         Lakshadweep's dot in #777777, which is no grammar ink
  4 ticks       the axis claims ticks 0 and 5 for data running -4.23 to 9.49 (the brief-3 bug)
  5 device      the note says "Dashed outline" and nothing is dashed (the brief-3 bug)
  6 sections    a chart label 4px above the notes (the "India 1.33%" bug)
"""
import re, sys
s = open(sys.argv[1]).read()
def sub(pat, rep):
    global s
    s2 = re.sub(pat, rep, s, count=1)
    assert s2 != s, pat
    s = s2
sub(r'(<text[^>]*font-weight=")400("[^>]*>Lakshadweep</text>)', r'\g<1>600\2')
sub(r'(<circle class="dot"[^>]*fill=")#9B9B9B("[^>]*data-id="LD")', r'\1#777777\2')
sub(r'data-ticks="-5 0 5 10"', 'data-ticks="0 5"')
sub(r'Not shown, for want of a comparable figure', 'Dashed outline: no comparable figure')
sub(r'(<g class="chart ranked-dots">)', r'\1<text x="500" y="1188" font-family="&quot;Inter&quot;" font-size="20" font-weight="400" fill="#666666">Planted 1.33</text>'
    r'<text x="65" y="330" font-family="&quot;Inter&quot;" font-size="20" font-weight="400" fill="#666666" style="font-variant-numeric:normal">7.0</text>')
open("planted_grammar.svg", "w").write(s)
