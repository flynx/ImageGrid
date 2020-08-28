#!/bin/env python

# this works...
l = [[]]
l[0] += [1]

# let's change the structure a bit...
l = ([],)

# now, this also works...
e = l[0]
e += [1]


# XXX and this fails...
l[0] += [1]


# and here is how...
## Traceback (most recent call last):
##   File "F:\work\ImageGrid\cur\ImageGrid\src\test\python-bug.py", line 17, in <module>
##     l[0][0] += [1]
## TypeError: 'tuple' object does not support item assignment
