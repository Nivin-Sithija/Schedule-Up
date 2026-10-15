FROM temporalio/temporal:1.4.1
USER root
COPY infra/start-temporal.sh /usr/local/bin/followthrough-temporal
RUN chmod 755 /usr/local/bin/followthrough-temporal
ENTRYPOINT ["/usr/local/bin/followthrough-temporal"]
