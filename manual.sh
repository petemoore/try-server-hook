#!/bin/bash

set -e

if [ x"$1" == x ] ; then echo "Missing remote" ; exit 1 ; fi
if [ x"$2" == x ] ; then echo "Missing commitish" ; exit 1 ; fi

echo "Pushing to try"
echo "Remote: $1"
echo "Commitish: $2"

rm -rf .gaia-try
hg clone http://hg.mozilla.org/integration/gaia-try .gaia-try
python -c "
import json
import random
with open('.gaia-try/gaia.json', 'w+') as f:
  data={
    'git': {
        'git_revision': 'master',
        'remote': 'http://github.com/mozilla-b2g/gaia.git',
        'pr_git_revision': '$2',
        'pr_remote': '$1',
    },
    random.randint(0,10000000): 'random'
  }
  json.dump(data, f, indent=2)
"
hg -R .gaia-try commit -m "Manually pushing $1 @ $2 to try $MSG"
if [ -z $NOPUSH ] ; then
    hg -R .gaia-try push -f ssh://hg.mozilla.org/integration/gaia-try
fi
