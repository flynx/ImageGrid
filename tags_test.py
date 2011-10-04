#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20111004222027'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

from time import time
import cPickle as pickle
import os

from pli.testlog import logstr

import tags


#-----------------------------------------------------------------------

TEST_DIR = 'test'
N = 100000
OBG_TPL = 'image%010d'


#-----------------------------------------------------------------------
#-----------------------------------------------------populate_tagset---
def populate_tagset(ts, count=N):
	for i in xrange(count):
		n = OBG_TPL % i
		ts.tag(n, 'image')
		if n.endswith('0'):
			ts.tag(n, '0')
		if n.endswith('5'):
			ts.tag(n, '5')
		if n.endswith('10'):
			ts.tag(n, '10')
	return ts

#---------------------------------------------------------save_tagset---
def save_tagset(ts, name='tags.db'):
	pickle.dump(ts, open(os.path.join(TEST_DIR, name), 'w'))
	return ts


#---------------------------------------------------------load_tagset---
def load_tagset(name='tags.db'):
	print 'loading tagset...',
	t0 = time()
	ts = pickle.load(open(os.path.join(TEST_DIR, name)))
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	return ts



#-----------------------------------------------------------------------
if __name__ == '__main__':

##	ts = tags.TagSetWithObjectIndex()

	test_code = '''
	len(ts.tags())
		-> 4

	len(ts.objects())
		-> 100000

	len(ts.all('10'))
		-> 1000

	len(ts.all('10', '0'))
		-> 1000

	len(ts.any('10', '5'))
		-> 11000

	len(ts.none('10', '5'))
		-> 89000


	ts.tags(OBG_TPL % 0)
		-> set(['0', 'image'])

	ts.tags(OBG_TPL % 10)
		-> set(['0', 'image', '10'])


	ts.relatedtags('image')
		-> set(['0', '5', '10'])

	ts.relatedtags('image', '0')
		-> set(['10'])

	ts.relatedtags('10')
		-> set(['0', 'image'])

	'''

	test_code2 = '''

	print 'selecting (all)...',
	t0 = time()
	ts.all('10', '0')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	print 'selecting (any)...',
	t0 = time()
	ts.any('10', '5')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	print 'selecting (none)...',
	t0 = time()
	ts.none('10', '5')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)

	print 'getting object tags...',
	t0 = time()
	res = ts.tags(OBG_TPL % 10)
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	'''


	logstr('''
	ts = tags.TagSet()

	populate_tagset(ts)
	save_tagset(ts)

	ts = load_tagset()

	''')

	logstr(test_code)
	

	logstr('''
	ts = tags.TagSetWithObjectIndex()

	populate_tagset(ts)
##	save_tagset(ts)
	''')

	logstr(test_code)
	



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
