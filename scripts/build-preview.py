# Build a single-file web preview: run `npx expo export --platform web` with the expo-router plugin set to
# ["expo-router", {"asyncRoutes": false}], then `python3 scripts/build-preview.py <export-dir> <out.html>`.
import glob, sys, os, base64
root, out = sys.argv[1], sys.argv[2]
js = open(glob.glob(f'{root}/_expo/static/js/web/entry-*.js')[0]).read()
mime = {'png': 'image/png', 'ttf': 'font/ttf', 'jpg': 'image/jpeg', 'svg': 'image/svg+xml', 'otf': 'font/otf'}
n = 0
for f in glob.glob(f'{root}/assets/**/*', recursive=True):
    if not os.path.isfile(f): continue
    key = '"/' + os.path.relpath(f, root) + '"'
    c = js.count(key)
    if c:
        n += c
        js = js.replace(key, '"data:' + mime[f.rsplit('.', 1)[1]] + ';base64,' + base64.b64encode(open(f, 'rb').read()).decode() + '"')
left = js.count('"/assets/')
js = js.replace('</script', '<\\/script')
html = f'''<title>Coil Fantasy</title>
<style>:root{{color-scheme:dark;--bg:#0B0B14}}html,body{{height:100%;margin:0;background:var(--bg)}}body{{overflow:hidden}}#root{{display:flex;height:100%;flex:1}}</style>
<script>try{{history.replaceState(null,'','/')}}catch(e){{}}</script>
<div id="root"></div><script>{js}</script>'''
open(out, 'w').write(html)
print('replaced', n, 'left', left, 'bytes', len(html))
