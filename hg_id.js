
// We're assuming output like this:
/*
[ { channel: 'o',
    length: 40,
    body: 'd235f11748f18837088cd1f0c0f84ed6df3def2c' },
  { channel: 'r', length: 4, body: '' } ]
*/
function hgId(repo, callback) {
  if (!repo || !repo.path) {
    return callback(new Error('Repo object is malformed'));
  }
  repo.log({'--limit': 1, '--template': '{node}'}, function (err, output) {
    var id;
    if (err) {
      return callback(err);
    }
    if (output.length != 2) {
      return callback(new Error('Incorrect amount of output for hgId'));
    } else if (output[0].channel !== 'o') {
      return callback(new Error('Output from hgId should be on stdout'));
    } else if (output[0].length !== 40 || output[0].body.length !== 40) {
      return callback(new Error('Node for hgId ought to be 40 chars'));
    } else if (output[1].body.length !== 0) {
      return callback(new Error('Expected extraneous output differs from expected content'));
    }
    id = output[0].body;
    console.log('HG id: ' + id);
    return callback(null, id);
  });
}

module.exports = hgId;
