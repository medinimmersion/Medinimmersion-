#!/data/data/com.termux/files/usr/bin/bash
set -e

cd ~/Medinimmersion-

echo "📥 Mise à jour du dépôt local..."
git pull origin main --rebase

echo "🗑️  Suppression des 25 fichiers .js dupliqués à la racine..."
git rm admin-dashboard.js admin-kalam-time.js admin.js bookings.js cms.js \
       dashboard-auth.js email-subscribers.js email.js gestion-contenu.js \
       group-attendance.js group-sessions.js groups-teacher.js kalam-books.js \
       members.js misc.js notifications.js pdfs.js presences.js progression.js \
       schedules.js sessions.js teacher-permissions.js teacher.js visits.js zoom.js

echo "🗑️  Suppression des pages et fichiers obsolètes..."
git rm cart.html test-kalam.html robots-2.txt sitemap-2.xml

echo "🐛 Suppression de kalam.html (corrige le bug de l'ancien chatbot)..."
git rm kalam.html

echo "🗑️  Suppression des dossiers mobile/ et docs/ (non utilisés par le site)..."
git rm -r mobile docs

echo "💾 Commit..."
git commit -m "Nettoyage: suppression du code mort, des doublons et des dossiers inutilisés"

echo "🚀 Envoi vers GitHub..."
git push origin main

echo ""
echo "✅ Terminé ! Render va redéployer automatiquement (2-3 minutes)."
echo "   Vérifiez ensuite que le site charge plus vite et que /kalam.html"
echo "   affiche bien Kalam Live (et non l'ancien chatbot)."
