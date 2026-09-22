# -*- coding: utf-8 -*-

from __future__ import absolute_import

import frappe
import os
import json
import time
import threading
import Queue


class DBProfiler(object):

    def __init__(self, log_file, queue_size=10000):
        self.log_file = log_file
        self.queue = Queue.Queue(maxsize=queue_size)
        self._stop = False

        self._thread = threading.Thread(
            target=self._writer_loop
        )
        self._thread.daemon = True
        self._thread.start()

    def log(self, data):
        try:
            self.queue.put_nowait(data)
        except Queue.Full:
            # Profiling must never slow down the application.
            pass

    def _writer_loop(self):
        directory = os.path.dirname(self.log_file)

        if directory and not os.path.exists(directory):
            try:
                os.makedirs(directory)
            except OSError:
                pass

        while not self._stop:
            try:
                data = self.queue.get(True, 1)

                try:
                    line = json.dumps(
                        data,
                        separators=(",", ":")
                    )

                    with open(self.log_file, "a") as f:
                        f.write(line)
                        f.write("\n")

                except Exception:
                    # Logging must never affect Frappe.
                    pass

                finally:
                    self.queue.task_done()

            except Queue.Empty:
                continue

    def stop(self):
        self._stop = True


# ----------------------------------------------------------------------
# Lazy global profiler
# ----------------------------------------------------------------------

_profiler = None

def get_profiler():
    global _profiler

    if _profiler is None:
        log_dir = frappe.get_site_path("logs", "db-profiler")
        log_file = "{0}-{1}.log".format(log_dir, os.getpid())
        _profiler = DBProfiler(log_file)

    return _profiler

def log_db(data):
    pass
    # get_profiler().log(data)