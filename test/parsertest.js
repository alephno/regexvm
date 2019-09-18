/* global describe, context, it */
const expect = require('chai').expect
const tok = require('../src/tokens.js')
const parser = require('../src/regex_parser.js')

describe('parse()', function () {
  const insertUnions = function (terms) {
    if (terms.length === 1) {
      return terms[0]
    } else {
      return {
        'type': tok.UNION,
        'left': terms[0],
        'right': insertUnions(terms.slice(1))
      }
    }
  }

  context('a single character', function () {
    it('should parse a single character', function () {
      expect(parser.parse('a')).to.eql([{ 'type': tok.CHAR, 'value': 'a' }])
      expect(parser.parse('B')).to.eql([{ 'type': tok.CHAR, 'value': 'B' }])
    })

    it('should parse \'.\' as any character', function () {
      expect(parser.parse('.')).to.eql([{ 'type': tok.DOT }])
    })

    it('should parse a single digit', function () {
      expect(parser.parse('1')).to.eql([{ 'type': tok.CHAR, 'value': '1' }])
    })

    it('should parse escape characters', function () {
      const escapableChars = '^[$.|?*+(){}[]'
      for (const c of escapableChars) {
        expect(parser.parse('\\' + c)).to.eql([{ 'type': tok.CHAR, 'value': c }])
      }
    })
  })

  context('sequences of characters', function () {
    it('lower case', function () {
      expect(parser.parse('abczxy')).to.eql([
        { 'type': tok.CHAR, 'value': 'a' },
        { 'type': tok.CHAR, 'value': 'b' },
        { 'type': tok.CHAR, 'value': 'c' },
        { 'type': tok.CHAR, 'value': 'z' },
        { 'type': tok.CHAR, 'value': 'x' },
        { 'type': tok.CHAR, 'value': 'y' }
      ])
    })

    it('upper case', function () {
      expect(parser.parse('ABCZXY')).to.eql([
        { 'type': tok.CHAR, 'value': 'A' },
        { 'type': tok.CHAR, 'value': 'B' },
        { 'type': tok.CHAR, 'value': 'C' },
        { 'type': tok.CHAR, 'value': 'Z' },
        { 'type': tok.CHAR, 'value': 'X' },
        { 'type': tok.CHAR, 'value': 'Y' }
      ])
    })

    it('digits', function () {
      expect(parser.parse('123094')).to.eql([
        { 'type': tok.CHAR, 'value': '1' },
        { 'type': tok.CHAR, 'value': '2' },
        { 'type': tok.CHAR, 'value': '3' },
        { 'type': tok.CHAR, 'value': '0' },
        { 'type': tok.CHAR, 'value': '9' },
        { 'type': tok.CHAR, 'value': '4' }
      ])
    })

    it('mix of cases and digits', function () {
      expect(parser.parse('ab12CD')).to.eql([
        { 'type': tok.CHAR, 'value': 'a' },
        { 'type': tok.CHAR, 'value': 'b' },
        { 'type': tok.CHAR, 'value': '1' },
        { 'type': tok.CHAR, 'value': '2' },
        { 'type': tok.CHAR, 'value': 'C' },
        { 'type': tok.CHAR, 'value': 'D' }
      ])
    })
  })

  context('bracket expressions', function () {
    /* it('should parse an empty bracket expression', function () {
      expect(parser.parse('[]')).to.eql([{
        'type': tok.BRACKET,
        'term': []
      }])
    }) */
    it('should parse a single value', function () {
      expect(parser.parse('[a]')).to.eql([{
        'type': tok.BRACKET,
        'term': {
          'type': tok.CHAR,
          'value': 'a'
        }
      }])
      expect(parser.parse('[.]')).to.eql([{
        'type': tok.BRACKET,
        'term': {
          'type': tok.CHAR,
          'value': '.'
        }
      }])
    })
    it('should parse a range', function () {
      expect(parser.parse('[a-z]')).to.eql([{
        'type': tok.BRACKET,
        'term': insertUnions('abcdefghijklmnopqrstuvwxyz'.split('').map(
          c => { return { 'type': tok.CHAR, 'value': c } }))
      }])
      expect(parser.parse('[1-9]')).to.eql([{
        'type': tok.BRACKET,
        'term': insertUnions('123456789'.split('').map(
          c => { return { 'type': tok.CHAR, 'value': c } }))
      }])
    })
    it('should parse a leading dash or ending dash literally', function () {
      expect(parser.parse('[-a]')).to.eql([{
        'type': tok.BRACKET,
        'term': {
          'type': tok.UNION,
          'left': {
            'type': tok.CHAR,
            'value': '-'
          },
          'right': {
            'type': tok.CHAR,
            'value': 'a'
          }
        }
      }])
      expect(parser.parse('[a-]')).to.eql([{
        'type': tok.BRACKET,
        'term': {
          'type': tok.UNION,
          'left': {
            'type': tok.CHAR,
            'value': 'a'
          },
          'right': {
            'type': tok.CHAR,
            'value': '-'
          }
        }
      }])
    })
    it('should parse escaped characters', function () {
      const escapableChars = '^[$.|?*+(){}[]'
      for (const c of escapableChars) {
        expect(parser.parse('[\\' + c + ']')).to.eql([{
          'type': tok.BRACKET,
          'term': {
            'type': tok.CHAR,
            'value': c
          }
        }])
      }
    })
    it('should parse a mix of characters, ranges, and escape chars', function () {
      expect(parser.parse('[-a-z\\^]')).to.eql([{
        'type': tok.BRACKET,
        'term': insertUnions('-abcdefghijklmnopqrstuvwxyz^'.split('').map(c => {
          return { 'type': tok.CHAR, 'value': c }
        }))
      }])
    })
  })

  context('countable repetitions', function () {
    it('should parse a character with a countable repetition', function () {
      expect(parser.parse('a{1,2}')).to.eql([{
        'type': tok.REP,
        'min': '1',
        'max': '2',
        'term': {
          'type': tok.CHAR,
          'value': 'a'
        }
      }])
      expect(parser.parse('.{1,2}')).to.eql([{
        'type': tok.REP,
        'min': '1',
        'max': '2',
        'term': {
          'type': tok.DOT
        }
      }])
      expect(parser.parse('\\?{1,2}')).to.eql([{
        'type': tok.REP,
        'min': '1',
        'max': '2',
        'term': {
          'type': tok.CHAR,
          'value': '?'
        }
      }])
    })
    it('should parse without an end value', function () {
      expect(parser.parse('a{1,}')).to.eql([{
        'type': tok.REP,
        'min': '1',
        'max': '',
        'term': {
          'type': tok.CHAR,
          'value': 'a'
        }
      }])
    })
    it('should parse a marked expression with a countable repetition', function () {
      expect(parser.parse('(1){2,4}')).to.eql([{
        'type': tok.REP,
        'min': '2',
        'max': '4',
        'term': {
          'type': tok.MARKED,
          'term': [{
            'type': tok.CHAR,
            'value': '1'
          }]
        }
      }])
    })
    it('should parse a bracket expression with a countable repetition', function () {
      expect(parser.parse('[ab]{1,5}')).to.eql([{
        'type': tok.REP,
        'min': '1',
        'max': '5',
        'term': {
          'type': tok.BRACKET,
          'term': {
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
        }
      }])
    })
  })

  context('zero or one', function () {
    it('should parse (?) with a character', function () {
      expect(parser.parse('1?')).to.eql([{
        'type': tok.QUEST,
        'term': {
          'type': tok.CHAR,
          'value': '1'
        } }])
    })
    it('should parse (?) with a \'.\'', function () {
      expect(parser.parse('.?')).to.eql([{
        'type': tok.QUEST,
        'term': {
          'type': tok.DOT
        } }])
    })
    it('should parse (?) with a marked group', function () {
      expect(parser.parse('(a)?')).to.eql([{
        'type': tok.QUEST,
        'term': {
          'type': tok.MARKED,
          'term': [{
            'type': tok.CHAR,
            'value': 'a'
          }]
        } }])
    })
    it('should parse (?) with a sequence', function () {
      expect(parser.parse('ab?')).to.eql([{
        'type': tok.CHAR,
        'value': 'a'
      }, {
        'type': tok.QUEST,
        'term': {
          'type': tok.CHAR,
          'value': 'b'
        }
      }])
    })
    it('should parse (?) with a union', function () {
      expect(parser.parse('a|b?')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }],
        'right': [{
          'type': tok.QUEST,
          'term': {
            'type': tok.CHAR,
            'value': 'b'
          }
        }]
      }])
    })
    it('should parse (?) with a counted repetition', function () {
      expect(parser.parse('a{1,2}?')).to.eql([{
        'type': tok.QUEST,
        'term': {
          'type': tok.REP,
          'min': '1',
          'max': '2',
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        } }])
    })
    it('should parse (?) with a bracket expression', function () {
      expect(parser.parse('[ab]?')).to.eql([{
        'type': tok.QUEST,
        'term': {
          'type': tok.BRACKET,
          'term': {
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
        } }])
    })
  })

  context('zero or more', function () {
    it('should parse (*) with a character', function () {
      expect(parser.parse('1*')).to.eql([{
        'type': tok.STAR,
        'term': {
          'type': tok.CHAR,
          'value': '1'
        } }])
    })
    it('should parse (*) with a \'.\'', function () {
      expect(parser.parse('.*')).to.eql([{
        'type': tok.STAR,
        'term': {
          'type': tok.DOT
        } }])
    })
    it('should parse (*) with a marked group', function () {
      expect(parser.parse('(a)*')).to.eql([{
        'type': tok.STAR,
        'term': {
          'type': tok.MARKED,
          'term': [{
            'type': tok.CHAR,
            'value': 'a'
          }]
        } }])
    })
    it('should parse (*) with a sequence', function () {
      expect(parser.parse('ab*')).to.eql([{
        'type': tok.CHAR,
        'value': 'a'
      }, {
        'type': tok.STAR,
        'term': {
          'type': tok.CHAR,
          'value': 'b'
        }
      }])
    })
    it('should parse (*) with a union', function () {
      expect(parser.parse('a|b*')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }],
        'right': [{
          'type': tok.STAR,
          'term': {
            'type': tok.CHAR,
            'value': 'b'
          }
        }]
      }])
    })
    it('should parse (*) with a counted repetition', function () {
      expect(parser.parse('a{1,2}*')).to.eql([{
        'type': tok.STAR,
        'term': {
          'type': tok.REP,
          'min': '1',
          'max': '2',
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        } }])
    })
    it('should parse (*) with a bracket expression', function () {
      expect(parser.parse('[ab]*')).to.eql([{
        'type': tok.STAR,
        'term': {
          'type': tok.BRACKET,
          'term': {
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
        } }])
    })
  })

  context('one or more', function () {
    it('should parse (+) with a character', function () {
      expect(parser.parse('1+')).to.eql([{
        'type': tok.PLUS,
        'term': {
          'type': tok.CHAR,
          'value': '1'
        } }])
    })
    it('should parse (+) with a \'.\'', function () {
      expect(parser.parse('.+')).to.eql([{
        'type': tok.PLUS,
        'term': {
          'type': tok.DOT
        } }])
    })
    it('should parse (+) with a marked group', function () {
      expect(parser.parse('(a)+')).to.eql([{
        'type': tok.PLUS,
        'term': {
          'type': tok.MARKED,
          'term': [{
            'type': tok.CHAR,
            'value': 'a'
          }]
        } }])
    })
    it('should parse (+) with a sequence', function () {
      expect(parser.parse('ab+')).to.eql([{
        'type': tok.CHAR,
        'value': 'a'
      }, {
        'type': tok.PLUS,
        'term': {
          'type': tok.CHAR,
          'value': 'b'
        }
      }])
    })
    it('should parse (+) with a union', function () {
      expect(parser.parse('a|b+')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }],
        'right': [{
          'type': tok.PLUS,
          'term': {
            'type': tok.CHAR,
            'value': 'b'
          }
        }]
      }])
    })
    it('should parse (+) with a counted repetition', function () {
      expect(parser.parse('a{1,2}+')).to.eql([{
        'type': tok.PLUS,
        'term': {
          'type': tok.REP,
          'min': '1',
          'max': '2',
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        } }])
    })
    it('should parse (+) with a bracket expression', function () {
      expect(parser.parse('[ab]+')).to.eql([{
        'type': tok.PLUS,
        'term': {
          'type': tok.BRACKET,
          'term': {
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
        } }])
    })
  })

  context('unions', function () {
    it('should parse with two characters', function () {
      expect(parser.parse('1|.')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': '1'
        }],
        'right': [{
          'type': tok.DOT
        }]
      }])
    })
    it('should parse with an empty right operand', function () {
      expect(parser.parse('1|')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': '1'
        }],
        'right': []
      }])
    })
    it('should parse with sequences of characters', function () {
      expect(parser.parse('ab|cd')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }, {
          'type': tok.CHAR,
          'value': 'b'
        }],
        'right': [{
          'type': tok.CHAR,
          'value': 'c'
        }, {
          'type': tok.CHAR,
          'value': 'd'
        }]
      }])
    })
    it('should parse with bracket expressions', function () {
      expect(parser.parse('[a]|[ab]')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.BRACKET,
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        }],
        'right': [{
          'type': tok.BRACKET,
          'term': {
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
        }]
      }])
    })
    it('should parse with counted repetitions', function () {
      expect(parser.parse('a{1,2}|b{3,4}')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.REP,
          'min': '1',
          'max': '2',
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        }],
        'right': [{
          'type': tok.REP,
          'min': '3',
          'max': '4',
          'term': {
            'type': tok.CHAR,
            'value': 'b'
          }
        }]
      }])
    })
    it('should parse with multiple unions', function () {
      expect(parser.parse('ab|cd|e')).to.eql([{
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }, {
          'type': tok.CHAR,
          'value': 'b'
        }],
        'right': [{
          'type': tok.UNION,
          'left': [{
            'type': tok.CHAR,
            'value': 'c'
          }, {
            'type': tok.CHAR,
            'value': 'd'
          }],
          'right': [{
            'type': tok.CHAR,
            'value': 'e'
          }]
        }]
      }])
    })
  })

  context('groups', function () {
    it('should parse a marked character', function () {
      expect(parser.parse('(a)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.CHAR,
          'value': 'a'
        }]
      }])
      expect(parser.parse('(.)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.DOT
        }]
      }])
    })
    it('should parse a marked sequence of characters', function () {
      expect(parser.parse('(abc)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.CHAR,
          'value': 'a'
        }, {
          'type': tok.CHAR,
          'value': 'b'
        }, {
          'type': tok.CHAR,
          'value': 'c'
        }]
      }])
    })
    it('should parse a marked repetition', function () {
      expect(parser.parse('(a{1,2})')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.REP,
          'min': '1',
          'max': '2',
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        }]
      }])
    })
    it('should parse a marked union', function () {
      expect(parser.parse('(a|b)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.UNION,
          'left': [{
            'type': tok.CHAR,
            'value': 'a'
          }],
          'right': [{
            'type': tok.CHAR,
            'value': 'b'
          }]
        }]
      }])
    })
    it('should parse a marked bracket expressions', function () {
      expect(parser.parse('([ab])')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.BRACKET,
          'term': {
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
        }]
      }])
    })
    it('should parse a marked ? * and +', function () {
      expect(parser.parse('(a?)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.QUEST,
          'term': {
            'type': tok.CHAR,
            'value': 'a'
          }
        }]
      }])
      expect(parser.parse('(1*)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.STAR,
          'term': {
            'type': tok.CHAR,
            'value': '1'
          }
        }]
      }])
      expect(parser.parse('(.+)')).to.eql([{
        'type': tok.MARKED,
        'term': [{
          'type': tok.PLUS,
          'term': {
            'type': tok.DOT
          }
        }]
      }])
    })
  })

  context('compound expressions', function () {
    it('should parse chains of different expressions', function () {
      expect(parser.parse('ab+([a-z]{1,2})|')).to.eql([ {
        'type': tok.UNION,
        'left': [{
          'type': tok.CHAR,
          'value': 'a'
        }, {
          'type': tok.PLUS,
          'term': {
            'type': tok.CHAR,
            'value': 'b'
          }
        }, {
          'type': tok.MARKED,
          'term': [{
            'type': tok.REP,
            'min': '1',
            'max': '2',
            'term': {
              'type': tok.BRACKET,
              'term': insertUnions('abcdefghijklmnopqrstuvwxyz'.split('').map(
                c => { return { 'type': tok.CHAR, 'value': c } }))
            }
          }]
        }],
        'right': []
      }])
    })
  })
})
