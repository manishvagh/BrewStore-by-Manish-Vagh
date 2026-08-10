#!/bin/bash
set -e
WWW=/www/wwwroot/manishvagh.in
BS_SRC=/tmp/brewstore-site
LL_SRC=/tmp/leadlock-public/public
if [ ! -f "$LL_SRC/index.html" ]; then
  LL_SRC=/tmp/leadlock-public
fi
SECURE=/tmp/leadlock-secure/products
if [ ! -d "$SECURE" ]; then
  SECURE=/tmp/leadlock-secure
fi

echo "=== migrate LeadLock to /leadlock if needed ==="
mkdir -p "$WWW"
if [ ! -d "$WWW/leadlock" ] && [ -f "$WWW/index.html" ]; then
  # Move current root (LeadLock) into leadlock/, keep panel files
  mkdir -p /tmp/ll-migrate
  find "$WWW" -mindepth 1 -maxdepth 1 \
    ! -name '.user.ini' ! -name '.htaccess' ! -name 'leadlock' \
    -exec mv {} /tmp/ll-migrate/ \;
  mkdir -p "$WWW/leadlock"
  mv /tmp/ll-migrate/* "$WWW/leadlock/" 2>/dev/null || true
  mv /tmp/ll-migrate/.[!.]* "$WWW/leadlock/" 2>/dev/null || true
  rmdir /tmp/ll-migrate 2>/dev/null || true
  echo "Migrated existing root into /leadlock"
else
  echo "leadlock already present or root empty — skip migrate move"
fi

echo "=== refresh LeadLock files ==="
DEST="$WWW/leadlock"
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 ! -name '_ops' -exec rm -rf {} +
cp -a "$LL_SRC"/. "$DEST/"
mkdir -p "$DEST/_ops/orders" "$DEST/_ops/products"
if [ -d "$SECURE" ]; then
  cp -a "$SECURE"/. "$DEST/_ops/products/" 2>/dev/null || true
fi
rm -rf "$DEST/product"
touch "$DEST/_ops/leads.jsonl"
chown -R www:www "$DEST/_ops" || true
chown -R www:www "$DEST/api" || true
chmod 775 "$DEST/_ops" "$DEST/_ops/orders" "$DEST/_ops/products"
chmod 666 "$DEST/_ops/leads.jsonl"

echo "=== deploy BrewStore to site root ==="
# remove old LeadLock root leftovers but keep leadlock/, panel files
find "$WWW" -mindepth 1 -maxdepth 1 \
  ! -name '.user.ini' ! -name '.htaccess' ! -name 'leadlock' \
  -exec rm -rf {} +
cp -a "$BS_SRC"/. "$WWW/"
# do not leave a nested leadlock from brewstore assets
chown -R www:www "$WWW/assets" "$WWW/index.html" "$WWW/styles.css" 2>/dev/null || true

echo "=== nginx deny rules ==="
mkdir -p /www/server/panel/vhost/nginx/extension/manishvagh.in
cat > /www/server/panel/vhost/nginx/extension/manishvagh.in/leadlock-deny.conf <<'NGX'
location ^~ /leadlock/_ops/ { return 404; }
location ^~ /leadlock/product/ { return 404; }
location ^~ /leadlock/api/_lib.php { return 404; }
location ^~ /_ops/ { return 404; }
location ^~ /product/ { return 404; }
NGX
nginx -t && nginx -s reload

echo "=== listing ==="
ls -la "$WWW"
ls -la "$WWW/leadlock" | head -20
echo DEPLOY_OK
