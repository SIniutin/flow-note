package service

import (
	commonrt "github.com/flow-note/common/realtime"
	"github.com/flow-note/notify-service/internal/repository"
)

type Service struct {
	notifications repository.NotificationRepository
	realtime      commonrt.Publisher
}
