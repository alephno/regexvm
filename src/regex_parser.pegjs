/*
Still to parse for "common" expressions in order of personal interest:
  negation             [^...]
  non capturing groups (?:...)
  generate error for referencing a capture group that doesn't exist
  newline              \n
  carriage return      \r
  tab                  \t
  Null                 \0
  character classes    \w \W \d \D \s \S
  start of string      ^
  end of string        $
  word boundary        \b
  non-word boundary    \B
*/

{
  const tok = require('./tokens.js')

  let insertUnions = function(terms){
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
}

start
  = regex+

regex
  // writing right:regex instead of right:term allows for unions to be chained
  = left:term+ '|' right:regex* { return {
    'type': tok.UNION,
    'left': left,
    'right': right
  }}
  / term:term { return term }

term
  = factor:factor '+' { return {
    'type': tok.PLUS,
    'term': factor
  }}
  / factor:factor '*' { return {
    'type': tok.STAR,
    'term': factor
  }}
  / factor:factor '?' { return {
    'type': tok.QUEST,
    'term': factor
  }}
  / factor:factor { return factor }

factor
  = term:repeatable '{' m:$[0123456789]+ ',' n:$[0123456789]* '}' {
    if (n && m > n) {
      error(`min cannot be larger than max in {${m},${n}}`)
    }
    return {
    'type': tok.REP,
    'term': term,
    'min': m,
    'max': n
  }}
  / term:repeatable '{' n:$[0123456789]+ '}' { return {
    'type': tok.REP,
    'term': term,
    'min': n,
    'max': n
  }}
  / repeatable

repeatable
  = '[' terms:rangeValue* ']' { return {
    'type': tok.BRACKET,
    'term': insertUnions(terms.flat())
  }}
  / base:base { return base }

rangeValue
  = start:[^-] '-' end:[^-\]] {
    if (start > end) {
      error(`start must be less than end in range {${start}, ${end}}`)
    } else if (start === end) { return {
      'type': tok.CHAR,
      'value': start // or end, they're the same in this case
    }} else {
      let sIndex = start.charCodeAt(0)
      let eIndex = end.charCodeAt(0)
      let length = (eIndex - sIndex) + 1

      return [...Array(length).keys()].map(
        i => String.fromCharCode(i + sIndex)).map(
          value => { return {
            'type': tok.CHAR,
            'value': value
            }
          }
        )
    }
  }
  / escaped
  / char:[^\]] { return {
    'type': tok.CHAR,
    'value': char
  }}

base
  = escaped
  / '(' term:regex+ ')' { return {
    'type': tok.MARKED,
    'term': term
  }}
  / '.' { return {
    'type': tok.DOT
  }}
  / char

char
  = char:[^\^\[\$\.\|\?\*\+\(\)\[] { return {
    'type': tok.CHAR,
    'value': char
  }}

escaped
  = '\\' index:[1-9] { return {
      'type': tok.GROUP,
      'index': index
    }}
  / '\\' escape:[^1-9] { return {
    'type': tok.CHAR,
    'value': escape
  }}