const { GenericImageCommand } = require('../../models/')

module.exports = new GenericImageCommand({
  triggers: ['angryman', 'note'],
  usage: '{command} <something to put on a note>',
  description: 'It is just a note bro',

  requiredArgs: 'You need to add something to make the note say, try again.',
  textLimit: 75,
  textOnly: true
})
