/* global describe, it */

const regex = require('../src/regex.js')
const assert = require('assert')
// const ops = require('../src/opcodes.js')
const tok = require('../src/tokens.js')

describe('Regex', function () {
  describe('#_countInstrRequired', function () {
    it('Should take 1 instrucion for a char', function () {
      const testRegex = new regex.Regex('a')
      const testTerm = {
        'type': tok.CHAR,
        'value': 'a'
      }
      assert.strict.equal(testRegex._countInstrRequired(testTerm), 1)
    })
    it('A union should take 1 + the number of instructions for each branch', function () {
      const testRegex = new regex.Regex('a|b')
      const testTerm = {
        'type': tok.UNION,
        'left': {
          'type': tok.CHAR,
          'value': 'a'
        },
        'right': {
          'type': tok.CHAR,
          'value': 'b'
        }
      }
      assert.strict.equal(testRegex._countInstrRequired(testTerm), 3)
    })
    it('Should take 1 extra instrucion for a repetition', function () {
      const testRegex = new regex.Regex('a+')
      const testTerm = {
        'type': tok.PLUS,
        'term': {
          'type': tok.CHAR,
          'value': 'a'
        }
      }
      assert.strict.equal(testRegex._countInstrRequired(testTerm), 2)
    })
    it('Should sum all instruction counts in an array of nodes', function () {
      const testRegex = new regex.Regex('a|b+')
      const testTerm = {
        'type': tok.UNION,
        'left': {
          'type': tok.CHAR,
          'value': 'a'
        },
        'right': {
          'type': tok.PLUS,
          'term': [{
            'type': tok.CHAR,
            'value': 'b'
          }]
        }
      }
      assert.strict.equal(testRegex._countInstrRequired(testTerm), 4)
    })
  })
  describe('#compile', function () {
    it('Should return a program of length 6 for a|(ab)', function () {
      const regexTest = new regex.Regex('a|(ab)')
      regexTest.parse()
      regexTest.compile()
      assert.strict.equal(regexTest._prog.length, 6)
    })
  })
})
