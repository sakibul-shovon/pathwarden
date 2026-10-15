Title: put() blocks forever when timeout=0
Labels: bug, queue

put(item, timeout=0) should return immediately when the queue is full, but it blocks.
