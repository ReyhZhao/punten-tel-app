"""
DatabaseCache met een `incr` die de verlooptijd laat staan.

Django's standaard-`incr` leest de waarde en schrijft hem opnieuw met de
standaard-timeout (5 minuten). Een teller "per uur" zou dan 5 minuten na de
laatste treffer al verlopen. Deze `incr` past alleen de waarde aan, met een
rijlock, zodat gelijktijdige verzoeken (andere workers) ook niets kwijtraken.
"""

import base64
import pickle

from django.core.cache.backends.db import DatabaseCache as BaseDatabaseCache
from django.db import connections, router, transaction
from django.utils.timezone import now as tz_now


class DatabaseCache(BaseDatabaseCache):
    def incr(self, key, delta=1, version=None):
        key = self.make_and_validate_key(key, version=version)
        db = router.db_for_write(self.cache_model_class)
        connection = connections[db]
        q = connection.ops.quote_name
        table = q(self._table)
        # Zoals Django's has_key: verlopen rijen tellen niet.
        now = tz_now().replace(microsecond=0, tzinfo=None)
        lock = " FOR UPDATE" if connection.features.has_select_for_update else ""
        with transaction.atomic(using=db), connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {q('value')} FROM {table} WHERE {q('cache_key')} = %s AND {q('expires')} > %s{lock}",
                [key, connection.ops.adapt_datetimefield_value(now)],
            )
            row = cursor.fetchone()
            if row is None:
                raise ValueError(f"Key '{key}' not found")
            value = pickle.loads(base64.b64decode(connection.ops.process_clob(row[0]).encode())) + delta
            cursor.execute(
                f"UPDATE {table} SET {q('value')} = %s WHERE {q('cache_key')} = %s",
                [base64.b64encode(pickle.dumps(value, self.pickle_protocol)).decode("latin1"), key],
            )
        return value
