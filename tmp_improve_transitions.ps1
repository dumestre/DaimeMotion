$root='F:\DaimeMotion\DaimeMotion\data\projects\7c8aa70e-9564-4ec2-9db6-30449e15c2e1\compositions\frames'
Get-ChildItem $root -Recurse -File -Filter '*.html' | ForEach-Object {
  $p=$_.FullName
  $content = Get-Content -Raw $p
  $content = $content -replace 'tl.fromTo\("#title", \{ opacity: 0, scale: 0.85, y: 40 \}, \{ opacity: 1, scale: 1, y: 0, duration: 1.4, ease: "power3.out" \}, 0.6\);',
    'tl.fromTo("#title", { opacity: 0, scale: 0.7, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 1.3, ease: "back.out(1.7)" }, 0.4);'
  $content = $content -replace 'tl.fromTo\("#line", \{ width: 0 \}, \{ width: 900, duration: 0.8, ease: "power2.out" \}, 1.6\);',
    'tl.fromTo("#line", { width: 0 }, { width: 960, duration: 0.7, ease: "power2.inOut" }, 1.5);'
  $content = $content -replace 'tl.fromTo\("#subtitle", \{ opacity: 0, y: 20 \}, \{ opacity: 1, y: 0, duration: 0.8, ease: "power2.out" \}, 2.0\);',
    'tl.fromTo("#subtitle", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "power4.out" }, 2.0);'
  Set-Content -Path $p -Value $content
}