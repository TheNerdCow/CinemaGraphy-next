#!/usr/bin/env python3
"""Fix landing.js copy button for HTTP (non-secure) contexts."""
from pathlib import Path
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else "src/runtimes/node/landing.js")
t = p.read_text(encoding="utf-8")
if "fallbackCopy" in t:
    print("already fixed")
    raise SystemExit(0)

old = """  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var val = btn.getAttribute('data-copy') || '';
      var orig = btn.getAttribute('data-label') || 'کپی لینک';
      var span = btn.querySelector('span') || btn;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(function(){
          btn.classList.add('copied'); span.textContent = 'کپی شد!';
          setTimeout(function(){ btn.classList.remove('copied'); span.textContent = orig; }, 1800);
        });
      }
    });
  });"""

new = """  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function markCopied(btn, span, orig) {
    btn.classList.add('copied');
    span.textContent = 'کپی شد!';
    setTimeout(function(){ btn.classList.remove('copied'); span.textContent = orig; }, 1800);
  }
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      var val = btn.getAttribute('data-copy') || '';
      if (!val) return;
      var orig = btn.getAttribute('data-label') || 'کپی لینک';
      var span = btn.querySelector('span') || btn;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(val).then(function(){
          markCopied(btn, span, orig);
        }).catch(function(){
          if (fallbackCopy(val)) markCopied(btn, span, orig);
        });
      } else if (fallbackCopy(val)) {
        markCopied(btn, span, orig);
      }
    });
  });"""

if old not in t:
    print("pattern not found")
    raise SystemExit(2)
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("OK fixed", p)
