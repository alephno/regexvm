const Regex = require('./regex.js')

const $textarea = document.querySelector('#testInput')
const $regInput = document.querySelector('#patternInput')
const $backdrop = document.querySelector('.input-backdrop')
const $highlights = document.querySelector('.input-highlights')

function applyHighlights (text, indices) {
  if (indices.length === 0) { return text }

  // we'll split the text into sections, mark the matches,
  // then join them back together
  const output = []
  // the bit before the first match
  output.push(text.slice(0, indices[0][0]))
  for (let i = 0; i < indices.length; i++) {
    const pair = indices[i]
    // mark around the matched text
    output.push('<mark>' + text.slice(pair[0], pair[1] + 1) + '</mark>')
    if ((i + 1) < indices.length) {
      // the bit between this pair and the next
      output.push(text.slice(pair[1] + 1, indices[i + 1][0]))
    }
  }
  // the bit from the last match to the end of the text
  output.push(text.slice(indices[indices.length - 1][1]))

  return output.reduce((acc, s) => acc + s, '')
}

function tryRegex () {
  const pattern = $regInput.value
  try {
    const regex = Regex.re(pattern)
    const text = $textarea.value
    const matches = regex.execute(text)
    if (matches.length > 0) {
      const highlightedText = applyHighlights(text, matches)
      // $highlights.insertAdjacentHTML('afterbegin', highlightedText)
      $highlights.innerHTML = highlightedText
    } else {
      $highlights.innerHTML = ''
    }
  } catch (err) {
    $highlights.innerHTML = '' // clear matches if the pattern didn't parse
    // TODO: helpful hints (regex didn't parse, no match)
  }
}

function bindEvents () {
  $textarea.addEventListener('input', tryRegex)
  $regInput.addEventListener('input', tryRegex)
  $textarea.addEventListener('scroll', scrollWithHighlights)
}

function scrollWithHighlights () {
  const scrollTop = $textarea.scrollTop
  $backdrop.scrollTop = scrollTop

  const scrollLeft = $textarea.scrollLeft
  $backdrop.scrollLeft = scrollLeft
}

bindEvents()
tryRegex()
