@echo off
powershell -NoProfile -Command "Get-ChildItem 'F:\DaimeMotion\DaimeMotion\data\projects\7c8aa70e-9564-4ec2-9db6-30449e15c2e1\compositions\frames' -Recurse -File -Filter '*.html' | ? { -not ($_ | Select-String 'back.out') } | % { $_.Name }"
