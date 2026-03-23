cd ~/dev/driftboard
git pull
echo "Pulled latest changes"
mkdir -p /var/www/motleytech/html/apps
rm -rf /var/www/motleytech/html/apps/tasks
cp -r dist /var/www/motleytech/html/apps/tasks
echo "Copied dist to /var/www/motleytech/html/apps/tasks"
echo "Done"

