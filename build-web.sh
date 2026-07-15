#!/bin/bash
# ============================================================
# Build web Juste Debout pour déploiement Netlify (drag-drop du dossier dist/).
#
# Corrige les chemins d'assets que Netlify IGNORE au déploiement manuel :
#   - dossiers "node_modules"
#   - dossiers "@scopés" (ex. @expo)
#   - le sous-dossier profond des polices d'icônes vector-icons
# → les polices d'icônes (Ionicons) sont aplaties dans assets/f/ pour être servies.
#
# Usage :  ./build-web.sh   puis glisser dist/ sur app.netlify.com (Deploys)
# ============================================================
set -e
cd "$(dirname "$0")"

echo "▶ Export web (expo)…"
CI=1 npx expo export --platform web --output-dir dist

cd dist

# 1) Netlify ignore "node_modules" → renommer en "vendormods".
if [ -d assets/node_modules ]; then
  echo "▶ Renommage assets/node_modules → assets/vendormods"
  mv assets/node_modules assets/vendormods
  for f in $(grep -rl "assets/node_modules" _expo index.html 2>/dev/null); do
    sed -i '' 's#assets/node_modules#assets/vendormods#g' "$f"
  done
fi

# 2) Netlify ignore les dossiers @scopés + ce chemin profond → aplatir les polices d'icônes.
DEEP="assets/vendormods/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
if [ -d "$DEEP" ]; then
  echo "▶ Aplatissement des polices d'icônes → assets/f/"
  mkdir -p assets/f
  mv "$DEEP"/*.ttf assets/f/
  for f in $(grep -rl "$DEEP" _expo index.html 2>/dev/null); do
    sed -i '' "s#$DEEP/#assets/f/#g" "$f"
  done
fi

# SPA routing (expo-router output:single) — sinon rafraîchir une sous-page = 404 Netlify.
printf '/*    /index.html   200\n' > _redirects

# PWA : icône « Ajouter à l'écran d'accueil » (iOS + Android).
cp ../assets/images/icon-ios.png apple-touch-icon.png 2>/dev/null || cp ../assets/images/icon.png apple-touch-icon.png 2>/dev/null
python3 - <<'PY'
p='index.html'; s=open(p).read()
meta=('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
      '<meta name="apple-mobile-web-app-capable" content="yes">'
      '<meta name="apple-mobile-web-app-title" content="Juste Debout">'
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">')
if 'apple-touch-icon' not in s:
    open(p,'w').write(s.replace('</head>', meta+'</head>', 1))
PY

echo ""
echo "✅ Build web prêt : $(pwd)"
echo "   → Glisse ce dossier 'dist' sur app.netlify.com (projet justedeboutapp → Deploys)."
