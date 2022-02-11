cd otel-extension
chmod +x index.js
npm install
cd -

chmod +x extensions/otel-extension

archive="./extension.zip"
if [ -f $archive ] ; then
    rm $archive
fi

rm -r ./otel-extension/build
rm -r ./otel-extension/node-modules
cd ./otel-extension
npm ci --only=prod
cd ..

zip -r $archive ./otel-extension
zip -r $archive ./extensions