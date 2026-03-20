cd ~/dev/driftboard
git pull
echo "Pulled latest changes"
rm -rf /var/www/motleytech/html/tasks
cp -r dist /var/www/motleytech/html/tasks
echo "Copied dist to /var/www/motleytech/html/tasks"
echo "Done"

