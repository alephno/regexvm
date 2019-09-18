# Regular Expression Engine and Vidualizer

![AltText](/screenshot.png?raw=true "Regex Visualizer")

## About

A regular expression engine implemented as a virtual machine and using Pegjs https://pegjs.org/ for parsing.

Somewhat supported syntax:
- .
- +
- *
- ?
- {m,n} and {n} counted repetitions
- [a-z] ranges
- escaped characters
- | or expressions
- () capture groups and referencing capture groups, i.e (a|b)\1

Not supported yet:
- negation             [^...]
- non capturing groups (?:...)
- newline              \n
- carriage return      \r
- tab                  \t
- Null                 \0
- character classes    \w \W \d \D \s \S
- start of string      ^
- end of string        $
- word boundary        \b
- non-word boundary    \B

## Instructions

1. run "npm install"
2. run "npm start"
3. navigate to localhost:3000
