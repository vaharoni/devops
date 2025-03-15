These were collected after installing a production and a staging cluster without overriding any configurations, and creating one backup.

# Seeing all CRDs of the Stackgres operator

```shell
kubectl api-resources | grep stackgres
```

```text
sgbackups                           sgbkp                                      stackgres.io/v1                   true         SGBackup
sgclusters                          sgclu                                      stackgres.io/v1                   true         SGCluster
sgconfigs                                                                      stackgres.io/v1                   true         SGConfig
sgdbops                             sgdo                                       stackgres.io/v1                   true         SGDbOps
sgdistributedlogs                   sgdil                                      stackgres.io/v1                   true         SGDistributedLogs
sginstanceprofiles                  sginp                                      stackgres.io/v1                   true         SGInstanceProfile
sgobjectstorages                    sgobjs                                     stackgres.io/v1beta1              true         SGObjectStorage
sgpgconfigs                         sgpgc,sgpostgresconfig,sgpostgresconfigs   stackgres.io/v1                   true         SGPostgresConfig
sgpoolconfigs                       sgpoc,sgpoolingconfig,sgpoolingconfigs     stackgres.io/v1                   true         SGPoolingConfig
sgscripts                           sgscr                                      stackgres.io/v1                   true         SGScript
sgshardedbackups                    sgsbk                                      stackgres.io/v1                   true         SGShardedBackup
sgshardedclusters                   sgscl                                      stackgres.io/v1alpha1             true         SGShardedCluster
sgshardeddbops                      sgsdo                                      stackgres.io/v1                   true         SGShardedDbOps
sgstreams                           sgstr                                      stackgres.io/v1alpha1             true         SGStream
```

# Listing clusters

```shell
kubectl get sgclusters -A -o wide
```

```text
NAMESPACE       NAME            VERSION   INSTANCES   PROFILE                                DISK   PROMETHEUS-AUTOBIND   POOL-CONFIG                            POSTGRES-CONFIG
db-production   db-production   17.4      2           generated-from-default-1741901158922   64Gi   true                  generated-from-default-1741901159399   postgres-17-generated-from-default-1741901159027
db-staging      db-staging      17.4      1           generated-from-default-1741897965313   20Gi   true                  generated-from-default-1741897965363   postgres-17-generated-from-default-1741897965337
```

# Listing backups

```shell
kubectl get -A sgbkp -o wide
```

```text
NAMESPACE    NAME                    CLUSTER      MANAGED   STATUS      PG-VERSION   COMPRESSED-SIZE   TIMELINE
db-staging   bk2025-03-13-22-22-24   db-staging   true      Completed   170004       5793582           1
```

# The default values of postgres configs

These are the same between production and staging, i.e. regardless of the profile used.

```shell
kubectl describe -n db-production sgpgconfigs
```

```text
Name:         postgres-17-generated-from-default-1741901159027
Namespace:    db-production
Labels:       <none>
Annotations:  stackgres.io/operatorVersion: 1.15.2
API Version:  stackgres.io/v1
Kind:         SGPostgresConfig
Metadata:
  Creation Timestamp:  2025-03-13T21:25:59Z
  Generation:          1
  Resource Version:    1522786
  UID:                 95ab897a-b99a-44c9-90ce-e1ce8b4f5dda
Spec:
  Postgres Version:  17
  postgresql.conf:
    autovacuum_max_workers:            3
    autovacuum_vacuum_cost_delay:      2ms
    autovacuum_work_mem:               512MB
    checkpoint_completion_target:      0.9
    checkpoint_timeout:                15min
    default_statistics_target:         200
    default_toast_compression:         lz4
    enable_partitionwise_aggregate:    on
    enable_partitionwise_join:         on
    huge_pages:                        off
    jit_inline_above_cost:             -1
    log_autovacuum_min_duration:       0ms
    log_checkpoints:                   on
    log_connections:                   on
    log_disconnections:                on
    log_line_prefix:                   %t [%p]: db=%d,user=%u,app=%a,client=%h
    log_lock_waits:                    on
    log_min_duration_statement:        1s
    log_statement:                     none
    log_temp_files:                    0kB
    maintenance_work_mem:              2GB
    max_locks_per_transaction:         128
    max_pred_locks_per_transaction:    128
    max_prepared_transactions:         32
    max_replication_slots:             20
    max_wal_senders:                   20
    max_wal_size:                      2GB
    min_wal_size:                      1GB
    pg_stat_statements.track_utility:  off
    random_page_cost:                  1.5
    shared_preload_libraries:          pg_stat_statements, auto_explain
    superuser_reserved_connections:    8
    track_activity_query_size:         4kB
    track_commit_timestamp:            on
    track_functions:                   pl
    track_io_timing:                   on
    wal_keep_size:                     1536MB
    work_mem:                          10MB
Status:
  Default Parameters:
    archive_command:                   /bin/true
    archive_mode:                      on
    autovacuum_max_workers:            3
    autovacuum_vacuum_cost_delay:      2
    autovacuum_work_mem:               512MB
    checkpoint_completion_target:      0.9
    checkpoint_timeout:                15min
    default_statistics_target:         200
    default_toast_compression:         lz4
    enable_partitionwise_aggregate:    on
    enable_partitionwise_join:         on
    Fsync:                             on
    hot_standby:                       on
    huge_pages:                        off
    jit_inline_above_cost:             -1
    lc_messages:                       C
    log_autovacuum_min_duration:       0ms
    log_checkpoints:                   on
    log_connections:                   on
    log_destination:                   stderr
    log_directory:                     log
    log_disconnections:                on
    log_filename:                      postgres-%M.log
    log_line_prefix:                   %t [%p]: db=%d,user=%u,app=%a,client=%h
    log_lock_waits:                    on
    log_min_duration_statement:        1000
    log_rotation_age:                  30min
    log_rotation_size:                 0kB
    log_statement:                     none
    log_temp_files:                    0
    log_truncate_on_rotation:          on
    logging_collector:                 off
    maintenance_work_mem:              2GB
    max_locks_per_transaction:         128
    max_pred_locks_per_transaction:    128
    max_prepared_transactions:         32
    max_replication_slots:             20
    max_wal_senders:                   20
    max_wal_size:                      2GB
    min_wal_size:                      1GB
    pg_stat_statements.track_utility:  off
    random_page_cost:                  1.5
    shared_preload_libraries:          pg_stat_statements, auto_explain
    superuser_reserved_connections:    8
    track_activity_query_size:         4096
    track_commit_timestamp:            on
    track_functions:                   pl
    track_io_timing:                   on
    wal_compression:                   on
    wal_keep_size:                     1536MB
    wal_level:                         logical
    wal_log_hints:                     on
    work_mem:                          10MB
Events:                                <none>
```

# The default values of pooling configs

These are the same between production and staging, i.e. regardless of the profile used.

```shell
kubectl describe -n db-production sgpoolconfigs
```

```text
Name:         generated-from-default-1741901159399
Namespace:    db-production
Labels:       <none>
Annotations:  stackgres.io/operatorVersion: 1.15.2
API Version:  stackgres.io/v1
Kind:         SGPoolingConfig
Metadata:
  Creation Timestamp:  2025-03-13T21:25:59Z
  Generation:          1
  Resource Version:    1522787
  UID:                 83ebc646-3d1b-493d-935f-b175c731721f
Spec:
  Pg Bouncer:
    pgbouncer.ini:
      Pgbouncer:
        default_pool_size:          1000
        ignore_startup_parameters:  extra_float_digits
        max_client_conn:            1000
        max_db_connections:         0
        max_user_connections:       0
        pool_mode:                  session
Status:
  Pg Bouncer:
    Default Parameters:
      admin_users:                pgbouncer_admin
      application_name_add_host:  1
      auth_query:                 SELECT usename, passwd FROM pg_shadow WHERE usename=$1
      auth_type:                  md5
      auth_user:                  authenticator
      default_pool_size:          1000
      ignore_startup_parameters:  extra_float_digits
      max_client_conn:            1000
      max_db_connections:         0
      max_user_connections:       0
      pool_mode:                  session
      server_check_query:         ;
      stats_users:                pgbouncer_stats
Events:                           <none>
```

# The default values of instance profiles

These are the same between production and staging, i.e. regardless of the profile used.

```shell
kubectl describe -n db-production sginp
```

```text
Name:         generated-from-default-1741901158922
Namespace:    db-production
Labels:       <none>
Annotations:  stackgres.io/operatorVersion: 1.15.2
API Version:  stackgres.io/v1
Kind:         SGInstanceProfile
Metadata:
  Creation Timestamp:  2025-03-13T21:25:58Z
  Generation:          1
  Resource Version:    1522785
  UID:                 ed689dae-c025-4a4b-8dbd-498749d4ecb1
Spec:
  Containers:
    backup.create-backup:
      Cpu:     1
      Memory:  256Mi
    Cluster - Controller:
      Cpu:     250m
      Memory:  512Mi
    dbops.run-dbops:
      Cpu:     1
      Memory:  256Mi
    dbops.set-dbops-result:
      Cpu:     1
      Memory:  256Mi
    Envoy:
      Cpu:     250m
      Memory:  64Mi
    Fluent - Bit:
      Cpu:     63m
      Memory:  64Mi
    Fluentd:
      Cpu:     250m
      Memory:  2Gi
    Pgbouncer:
      Cpu:     250m
      Memory:  64Mi
    Postgres - Util:
      Cpu:     63m
      Memory:  64Mi
    Prometheus - Postgres - Exporter:
      Cpu:     63m
      Memory:  256Mi
  Cpu:         1
  Init Containers:
    Cluster - Reconciliation - Cycle:
      Cpu:     1
      Memory:  2Gi
    dbops.set-dbops-running:
      Cpu:     1
      Memory:  256Mi
    Distributedlogs - Reconciliation - Cycle:
      Cpu:     1
      Memory:  2Gi
    Major - Version - Upgrade:
      Cpu:     1
      Memory:  2Gi
    Pgbouncer - Auth - File:
      Cpu:     1
      Memory:  2Gi
    Relocate - Binaries:
      Cpu:     1
      Memory:  2Gi
    Reset - Patroni:
      Cpu:     1
      Memory:  2Gi
    Setup - Arbitrary - User:
      Cpu:     1
      Memory:  2Gi
    Setup - Scripts:
      Cpu:     1
      Memory:  2Gi
  Memory:      2Gi
  Requests:
    Containers:
      backup.create-backup:
        Cpu:     1
        Memory:  256Mi
      Cluster - Controller:
        Cpu:     250m
        Memory:  512Mi
      dbops.run-dbops:
        Cpu:     1
        Memory:  256Mi
      dbops.set-dbops-result:
        Cpu:     1
        Memory:  256Mi
      Envoy:
        Cpu:     250m
        Memory:  64Mi
      Fluent - Bit:
        Cpu:     63m
        Memory:  64Mi
      Fluentd:
        Cpu:     250m
        Memory:  2Gi
      Pgbouncer:
        Cpu:     250m
        Memory:  64Mi
      Postgres - Util:
        Cpu:     63m
        Memory:  64Mi
      Prometheus - Postgres - Exporter:
        Cpu:     63m
        Memory:  256Mi
    Cpu:         1
    Init Containers:
      Cluster - Reconciliation - Cycle:
        Cpu:     1
        Memory:  2Gi
      dbops.set-dbops-running:
        Cpu:     1
        Memory:  256Mi
      Distributedlogs - Reconciliation - Cycle:
        Cpu:     1
        Memory:  2Gi
      Major - Version - Upgrade:
        Cpu:     1
        Memory:  2Gi
      Pgbouncer - Auth - File:
        Cpu:     1
        Memory:  2Gi
      Relocate - Binaries:
        Cpu:     1
        Memory:  2Gi
      Reset - Patroni:
        Cpu:     1
        Memory:  2Gi
      Setup - Arbitrary - User:
        Cpu:     1
        Memory:  2Gi
      Setup - Scripts:
        Cpu:     1
        Memory:  2Gi
    Memory:      2Gi
Events:          <none>
```
