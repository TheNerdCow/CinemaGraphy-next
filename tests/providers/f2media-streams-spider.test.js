import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDetailStreams } from '../../src/providers/f2media/parse.js'

/** Minimal fixture mirroring Spider-Man Brand New Day download box (4DUB + RSUB). */
const fixture = `
<div class="download-list dubbled">
  <div>کیفیت : WEB-DL 4K 2160p 10bit HDR</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.IMAX.2160p.HDR.WEB-DL.x265.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 1080p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.1080p.WEB-DL.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 1080p 10bit x265</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.1080p.10bit.WEB-DL.x265.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 720p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.720p.WEB-DL.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 720p 10bit x265</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.720p.10bit.WEB-DL.x265.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 480p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.480p.WEB-DL.Farsi.4Dubbed.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : صوت دوبله فارسی</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/4DUB/Spider-Man.Brand.New.Day.2026.Dubbed.Audio.Soren.mka">دانلود مستقیم</a>
</div>
<div class="download-list hardsub">
  <div>کیفیت : WEB-DL 4K 2160p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/RSUB/Spider-Man.Brand.New.Day.2026.2160p.HDR10Plus.DV.WEB-DL.6CH.x265.PSA.Farsi.Sub.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 1080p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/RSUB/Spider-Man.Brand.New.Day.2026.1080p.WEB-DL.6CH.YIFY.Farsi.Sub.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 720p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/RSUB/Spider-Man.Brand.New.Day.2026.720p.WEB-DL.YIFY.Farsi.Sub.Film2Media.mkv">دانلود مستقیم</a>
  <div>کیفیت : WEB-DL 480p</div>
  <a href="https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Spider-Man.Brand.New.Day.2026/RSUB/Spider-Man.Brand.New.Day.2026.480p.WEB-DL.Farsi.Sub.Film2Media.mkv">دانلود مستقیم</a>
</div>
`

test('spider-man style page finds 720p and 480p (not truncated)', () => {
  const streams = parseDetailStreams(fixture, 'https://www.myf2ms.top')
  assert.ok(streams.length >= 10, `expected >=10 video streams, got ${streams.length}`)
  const qs = streams.map((s) => s.quality)
  assert.ok(qs.some((q) => /720/i.test(q || '')), 'missing 720p')
  assert.ok(qs.some((q) => /480/i.test(q || '')), 'missing 480p')
  assert.ok(qs.some((q) => /1080/i.test(q || '')), 'missing 1080p')
  assert.ok(qs.some((q) => /2160/i.test(q || '')), 'missing 2160p')
  assert.ok(streams.every((s) => !/\.mka$/i.test(s.url)), 'audio-only must be filtered')
  assert.ok(streams.some((s) => s.audio === 'dub'), 'expected dub')
  assert.ok(streams.some((s) => s.audio === 'sub'), 'expected sub')
})
