const ops = require('./opcodes.js')
const tok = require('./tokens.js')
const Parser = require('./regex_parser.js')

/**
 * Regex implemented as a virtual machine. Currently supports:
 *     grouping with '(' and ')',
 *     sequences of characters like 'abc'
 *     unions with '|'
 *     the one or more repetition with '+'
 */
// eslint-disable-next-line no-unused-vars
class Regex {
  /**
   * Constructs a new Regex representing the given regex string.
   *
   * @param {string} pattern A string representing a regex.
   */
  constructor (pattern) {
    this.regex = pattern
    this._ast = []
    this._prog = []
  }

  /**
   * Parse the regex using the generated pargser from Pegjs.
   */
  parse () {
    this._ast = Parser.parse(this.regex)
  }

  /**
   * Calculates the number of instructions required to implement the given term(s).
   *
   * @param {Object|Array} term Either an array of terms or a single term.
   * @returns {number} The number of instructions to implement the given term(s).
   */
  _countInstrRequired (term) {
    if (Array.isArray(term)) {
      return term.reduce((acc, t) => acc + this._countInstrRequired(t), 0)
    } else {
      switch (term['type']) {
        case tok.CHAR: return 1
        case tok.DOT: return 1
        case tok.GROUP: return 1
        case tok.UNION: return this._countInstrRequired(term['left']) + 2 +
                             this._countInstrRequired(term['right'])
        case tok.QUEST:
        case tok.PLUS: return this._countInstrRequired(term['term']) + 1
        case tok.STAR: return this._countInstrRequired(term['term']) + 2
        case tok.REP: {
          const eCount = this._countInstrRequired(term['term'])
          if (term['max'] === '') {
            // e opcodes repeated min times plus an e* to give e{min, infinity}
            return eCount * (term['min'] + 1) + 2
          } else {
            /* There are min number of repetitions of the codes for term
            plus a split and repeated term for every possible extra repetetion
            */
            return eCount * term['min'] + ((eCount + 1) * (term['max'] - term['min']))
          }
        }
        case tok.MARKED: return this._countInstrRequired(term['term']) + 2
        // Parser expands all ranges and converts the bracket expression into unions.
        // The generated unions are stored in 'term'
        case tok.BRACKET: return this._countInstrRequired(term['term'])
        default: return 0 // throw new Error(`Found unsupported term, ${term}`)
      }
    }
  }

  /**
   * Compile the parsed expression into instructions for the virtual machine.
   */
  compile () {
    // counter for subexpression matchings
    let captureIndex = 0
    const compileRec = (ast) => {
      if (Array.isArray(ast)) {
        ast.forEach(compileRec)
      } else {
        switch (ast['type']) {
          case tok.CHAR:
            this._prog.push({ op: ops.CHAR, value: ast['value'] })
            break
          case tok.DOT: this._prog.push({ 'op': ops.ANY })
            break
          case tok.UNION: {
            // the 1 accounts for the extra split
            const l1 = 1 + this._prog.length
            // the 2 accounts for the extra split and jump
            const l2 = 2 + this._prog.length + this._countInstrRequired(ast['left'])
            this._prog.push({ 'op': ops.SPLIT, 'left': l1, 'right': l2 })
            compileRec(ast['left'])
            // the 1 accounts for the jump
            const l3 = 1 + this._prog.length + this._countInstrRequired(ast['right'])
            this._prog.push({ 'op': ops.JUMP, 'addr': l3 })
            compileRec(ast['right'])
          }
            break
          case tok.PLUS: { // one or more
            const l1 = this._prog.length
            compileRec(ast['term'])
            const l2 = this._prog.length + 1
            this._prog.push({ 'op': ops.SPLIT, 'left': l1, 'right': l2 })
          }
            break
          case tok.STAR: { // zero or more
            const l1 = this._prog.length
            const l2 = l1 + 1 // 1 for the split
            const l3 = l2 + this._countInstrRequired(ast['term']) + 1 // 1 for the jump
            this._prog.push({ 'op': ops.SPLIT, 'left': l2, 'right': l3 })
            compileRec(ast['term'])
            this._prog.push({ 'op': ops.JUMP, 'addr': l1 })
          }
            break
          case tok.QUEST: { // zero or one
            const l1 = this._prog.length + 1
            const l2 = l1 + this._countInstrRequired(ast['term'])
            this._prog.push({ 'op': ops.SPLIT, 'left': l1, 'right': l2 })
            compileRec(ast['term'])
          }
            break
          case tok.REP: {
            const l2 = this._countInstrRequired(ast)
            for (let i = 0; i < ast['min']; i++) {
              compileRec(ast['term'])
            }
            for (let i = 0; i < ast['max'] - ast['min']; i++) {
              const l1 = this._prog.length + 1
              this._prog.push({ 'op': ops.SPLIT, 'left': l1, 'right': l2 })
              compileRec(ast['term'])
            }
          }
            break
          case tok.MARKED: {
            const index = captureIndex
            this._prog.push({ 'op': ops.START_CAPTURE, 'index': index })
            captureIndex++
            compileRec(ast['term'])
            this._prog.push({ 'op': ops.END_CAPTURE, 'index': index })
          }
            break
          case tok.BRACKET: compileRec(ast['term']) // just compile the unions
            break
          case tok.GROUP: this._prog.push({ 'op': ops.GROUP, 'index': +ast['index'] })
            break
          default:
            throw new Error(`Unsupported structure found in ast, ${ast['type']}`)
        }
      }
    }

    compileRec(this._ast)
    this._prog.push({ 'op': ops.MATCH })
  }

  /**
   * Returns all non overlapping matches to the regex in text.
   *
   * @param {string} text A string of text to search
   * @returns {Array} An arrary of pairs represent the start and end of all matches found.
   *                  Returns an empty array if no matches are found.
   */
  execute (text) {
    const matches = []

    // Search for a match from every starting point in text
    for (let startIndex = 0; startIndex < text.length; startIndex++) {
      const result = this._threadedMachine(text, startIndex)
      if ((result.end) > -1) {
        matches.push([startIndex, result.end])
        // set 'startindex' to 'result.end' to avoid overlapping matches
        startIndex = startIndex > result.end ? startIndex : result.end
      }
    }

    return matches
  }

  /**
   * Determine if the regex matches the given text at the given index.
   *
   * @param {string} text The text to search.
   * @param {number} startIndex The index in text to begin the attempted match.
   * @returns {object} An object with two keys representing the results of any match.
   *                   Key 'end' contains the end index, and key 'captures' is an
   */
  _threadedMachine (text, startIndex) {
    const threadPool = []
    // const maxThreads = 1000

    threadPool.push({ 'pc': 0, 'sp': startIndex, 'groups': [] })
    while (threadPool.length > 0) {
      const thread = threadPool.pop()
      let pc = thread['pc']
      let sp = thread['sp']
      const groups = thread['groups']

      let dead = false
      while (!dead && (sp < text.length)) {
        const instr = this._prog[pc]
        switch (instr.op) {
          case ops.MATCH:
            return { 'end': sp - 1, 'captures': groups }
          case ops.CHAR:
            if (text.charAt(sp) !== instr.value) {
              dead = true
              break
            }
            pc++
            sp++
            break
          case ops.ANY:
            if (text.charAt(sp) === '\n') {
              dead = true
              break
            }
            pc++
            sp++
            break
          case ops.JUMP:
            pc = instr.addr
            break
          case ops.SPLIT:
            threadPool.push({ 'pc': instr.right, 'sp': sp, 'groups': [...groups] })
            pc = instr.left
            break
          case ops.START_CAPTURE:
            groups[instr.index] = [sp]
            pc++
            break
          case ops.END_CAPTURE:
            groups[instr.index].push(sp)
            pc++
            break
          case ops.GROUP:
            const matchText = text.slice(groups[instr.index - 1][0], groups[instr.index - 1][1])
            const input = text.slice(sp, sp + matchText.length)
            if (input === matchText) {
              sp += matchText.length
              pc++
            } else {
              dead = true
            }
            break
        }
      }
    }

    return { 'end': -1, 'captures': null }
  }

  /**
   * Factory method for convienence.
   * @param {Regex} regex A string representing a regular expression.
   */
  static re (pattern) {
    const regex = new Regex(pattern)
    regex.parse()
    regex.compile()
    return regex
  }
}

module.exports = Regex
