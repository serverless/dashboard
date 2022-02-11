cd otel-extension
chmod +x index.js
npm install
cd -

chmod +x extensions/otel-extension

buildFolder="extension"
archive="./extension.zip"
if [ -f $archive ] ; then
    rm $archive
fi
if [ -f $buildFolder ] ; then
    rm $buildFolder
fi
rm extension.zip

mkdir $buildFolder
mkdir $buildFolder/otel-extension

cd otel-extension
npm run build
cd ..
cp -a ./otel-extension/build/. ./$buildFolder/otel-extension
cp -R ./otel-extension/src/proto ./$buildFolder/otel-extension
cp -R ./otel-extension/otel-handler ./$buildFolder/otel-extension
cp -R ./extensions ./$buildFolder

cd $buildFolder

zip -r $archive ./otel-extension
zip -r $archive ./extensions

mv $archive ../
cd ..
rm -r $buildFolder
