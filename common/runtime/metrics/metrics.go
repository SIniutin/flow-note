package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type AppMetrics struct {
	HTTPRequests *prometheus.CounterVec
	WorkerRuns   *prometheus.CounterVec
}

func New(namespace string) *AppMetrics {
	return &AppMetrics{
		HTTPRequests: promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "http_requests_total",
			Help:      "Total HTTP requests.",
		}, []string{"route", "method", "status"}),
		WorkerRuns: promauto.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "worker_runs_total",
			Help:      "Background worker executions.",
		}, []string{"worker", "status"}),
	}
}

func Handler() http.Handler {
	return promhttp.Handler()
}
