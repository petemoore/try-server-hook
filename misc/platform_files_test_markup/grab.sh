#!/bin/bash

# 1.4 for a version that should have files
# 1.3t for a version that shouldn't have files
# aurora for the fallback case
# central for the master case
# /releases for mapping info
for i in \
  "https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-b2g30_v1_4-linux64_gecko/" \
  "https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-b2g28_v1_3t-linux32_gecko/" \
  "https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-aurora-linux32_gecko/" \
  "https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-linux32_gecko/" \
  "https://hg.mozilla.org/releases" \
  "https://hg.mozilla.org/releases/mozilla-b2g30_v1_4/raw-file/eb690ed47c24/browser/config/version.txt"
do
  filename="$(echo "$i" | sed -e 's,/$,,' | xargs basename)"
  curl -L -i -o "$filename" "$i"
  echo Saved file to $filename you should add to git
done
