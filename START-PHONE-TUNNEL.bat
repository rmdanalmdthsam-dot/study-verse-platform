@echo off
chcp 65001 >nul
title StudyVerse - نفق الربط السحابي للهاتف (Cloudflare Tunnel)
color 0A

echo =====================================================================
echo    🌐 تشغيل رابط السحابة الخارجي (Cloudflare Tunnel للهاتف والموبايل)
echo =====================================================================
echo.
echo هذا الملف يتيح لك فتح المنصة على هاتفك من أي مكان في العالم (عبر إنترنت الموبايل 4G/5G).
echo.

if exist "..\cloudflared.exe" (
    echo جارٍ إنشاء رابط سحابي مشفر وآمن مجاناً...
    echo.
    ..\cloudflared.exe tunnel --url http://localhost:5000
) else (
    echo لم يتم العثور على أداة cloudflared.exe في المسار الرئيسي.
    echo يمكنك الاتصال عبر الواي فاي الداخلي مباشرة من خلال مسح QR Code.
)
pause
