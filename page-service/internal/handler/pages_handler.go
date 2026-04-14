package handler

import (
	"context"
	"time"

	"github.com/flow-note/common/authctx"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	pagesv1 "github.com/flow-note/api-contracts/generated/proto/page/v1"

	"github.com/flow-note/page-service/internal/domain"
	"github.com/flow-note/page-service/internal/usecase"
)

// TODO: if Role not found - get it

// TODO: for all List functions should be pagination
type pagesHandler struct {
	pagesv1.UnimplementedPagesServiceServer

	logger            *zap.Logger
	pageUsecase       usecase.PageUsecase
	versionUsecase    usecase.VersionUsecase
	permissionUsecase usecase.PermissionUsecase
	linkUsecase       usecase.LinkUsecase
	mentionUsecase    usecase.MentionUsecase
	tableUsecase      usecase.TableUsecase
	mediaUsecase      usecase.MediaUsecase
}

func NewPagesHandler(
	logger *zap.Logger,
	pageUsecase usecase.PageUsecase,
	versionUsecase usecase.VersionUsecase,
	permissionUsecase usecase.PermissionUsecase,
	linkUsecase usecase.LinkUsecase,
	mentionUsecase usecase.MentionUsecase,
	tableUsecase usecase.TableUsecase,
	mediaUsecase usecase.MediaUsecase,
) *pagesHandler {
	return &pagesHandler{
		logger:            logger,
		pageUsecase:       pageUsecase,
		versionUsecase:    versionUsecase,
		permissionUsecase: permissionUsecase,
		linkUsecase:       linkUsecase,
		mentionUsecase:    mentionUsecase,
		tableUsecase:      tableUsecase,
		mediaUsecase:      mediaUsecase,
	}
}

func (h *pagesHandler) CreatePage(ctx context.Context, req *pagesv1.CreatePageRequest) (*pagesv1.CreatePageResponse, error) {
	startedAt := time.Now()
	h.logIn("CreatePage", zap.String("title", req.GetTitle()))
	if err := req.Validate(); err != nil {
		h.logWarn("CreatePage", startedAt, err, zap.String("title", req.GetTitle()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	ownerId, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		h.logWarn("CreatePage", startedAt, err, zap.String("title", req.GetTitle()))
		return nil, err
	}

	page, err := h.pageUsecase.CreatePage(ctx, ownerId, req.GetTitle())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("CreatePage", startedAt, zap.String("page_id", page.ID.String()))
	return &pagesv1.CreatePageResponse{Page: toProtoPage(page)}, nil
}

func (h *pagesHandler) GetPage(ctx context.Context, req *pagesv1.GetPageRequest) (*pagesv1.GetPageResponse, error) {
	startedAt := time.Now()
	h.logIn("GetPage", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("GetPage", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("GetPage", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	page, err := h.pageUsecase.GetPage(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GetPage", startedAt, zap.String("page_id", page.ID.String()))
	return &pagesv1.GetPageResponse{Page: toProtoPage(page)}, nil
}

func (h *pagesHandler) UpdatePage(ctx context.Context, req *pagesv1.UpdatePageRequest) (*pagesv1.UpdatePageResponse, error) {
	startedAt := time.Now()
	h.logIn("UpdatePage", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("UpdatePage", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	page, err := h.pageUsecase.UpdatePage(ctx, mustParseUUID(req.GetPageId()), req.GetTitle(), req.GetSize(), req.GetKeyToSnapshot())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("UpdatePage", startedAt, zap.String("page_id", page.ID.String()))
	return &pagesv1.UpdatePageResponse{Page: toProtoPage(page)}, nil
}

func (h *pagesHandler) DeletePage(ctx context.Context, req *pagesv1.DeletePageRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("DeletePage", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("DeletePage", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("DeletePage", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	if err = h.pageUsecase.DeletePage(ctx, userCredential, mustParseUUID(req.GetPageId())); err != nil {
		return nil, mapError(err)
	}

	h.logOut("DeletePage", startedAt, zap.String("page_id", req.GetPageId()))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) ListMyPages(ctx context.Context, req *pagesv1.ListMyPagesRequest) (*pagesv1.ListMyPagesResponse, error) {
	startedAt := time.Now()
	h.logIn("ListMyPages", zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListMyPages", startedAt, err, zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userId, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		h.logWarn("ListMyPages", startedAt, err, zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, err
	}

	pages, err := h.pageUsecase.ListMyPages(ctx, userId, req.GetPagination().GetLimit(), req.GetPagination().GetOffset())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListMyPages", startedAt, zap.Int("pages_count", len(pages)))
	return &pagesv1.ListMyPagesResponse{Pages: toProtoPages(pages)}, nil
}

func (h *pagesHandler) ListAllowedPages(ctx context.Context, req *pagesv1.ListAllowedPagesRequest) (*pagesv1.ListAllowedPagesResponse, error) {
	startedAt := time.Now()
	h.logIn("ListAllowedPages", zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListAllowedPages", startedAt, err, zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userId, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		h.logWarn("ListAllowedPages", startedAt, err, zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, err
	}

	pages, err := h.pageUsecase.ListAllowedPages(ctx, userId, req.GetPagination().GetLimit(), req.GetPagination().GetOffset())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListAllowedPages", startedAt, zap.Int("pages_count", len(pages)))
	return &pagesv1.ListAllowedPagesResponse{Pages: toProtoPages(pages)}, nil
}

func (h *pagesHandler) GetCurrentVersion(ctx context.Context, req *pagesv1.GetCurrentVersionRequest) (*pagesv1.GetCurrentVersionResponse, error) {
	startedAt := time.Now()
	h.logIn("GetCurrentVersion", zap.String("page_id", req.GetPageId()), zap.Int64("version_id", req.GetVersionId()))
	if err := req.Validate(); err != nil {
		h.logWarn("GetCurrentVersion", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int64("version_id", req.GetVersionId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("GetCurrentVersion", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int64("version_id", req.GetVersionId()))
		return nil, err
	}

	version, err := h.versionUsecase.GetCurrentVersion(ctx, userCredential, mustParseUUID(req.GetPageId()), req.GetVersionId())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GetCurrentVersion", startedAt, zap.Int64("version_id", version.Id))
	return &pagesv1.GetCurrentVersionResponse{Version: toProtoVersion(version)}, nil
}

func (h *pagesHandler) GetLastVersion(ctx context.Context, req *pagesv1.GetLastVersionRequest) (*pagesv1.GetLastVersionResponse, error) {
	startedAt := time.Now()
	h.logIn("GetLastVersion", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("GetLastVersion", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("GetLastVersion", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	version, err := h.versionUsecase.GetLastVersion(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GetLastVersion", startedAt, zap.Int64("version_id", version.Id))
	return &pagesv1.GetLastVersionResponse{Version: toProtoVersion(version)}, nil
}

func (h *pagesHandler) ListVersions(ctx context.Context, req *pagesv1.ListVersionsRequest) (*pagesv1.ListVersionsResponse, error) {
	startedAt := time.Now()
	h.logIn("ListVersions", zap.String("page_id", req.GetPageId()), zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListVersions", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("ListVersions", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int32("limit", req.GetPagination().GetLimit()), zap.Int32("offset", req.GetPagination().GetOffset()))
		return nil, err
	}

	versions, err := h.versionUsecase.ListVersions(ctx, userCredential, mustParseUUID(req.GetPageId()), req.GetPagination().GetLimit(), req.GetPagination().GetOffset())
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListVersions", startedAt, zap.Int("versions_count", len(versions)))
	return &pagesv1.ListVersionsResponse{Versions: toProtoVersions(versions)}, nil
}

func (h *pagesHandler) GrantPagePermission(ctx context.Context, req *pagesv1.GrantPagePermissionRequest) (*pagesv1.GrantPagePermissionResponse, error) {
	startedAt := time.Now()
	h.logIn("GrantPagePermission", zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()), zap.String("role", req.GetRole().String()))
	if err := req.Validate(); err != nil {
		h.logWarn("GrantPagePermission", startedAt, err, zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()), zap.String("role", req.GetRole().String()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("GrantPagePermission", startedAt, err, zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()), zap.String("role", req.GetRole().String()))
		return nil, err
	}

	permission, err := h.permissionUsecase.GrantPagePermission(
		ctx,
		userCredential,
		mustParseUUID(req.GetPageId()),
		mustParseUUID(req.GetUserId()),
		permissionRoleFromProto(req.GetRole()),
	)
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GrantPagePermission", startedAt, zap.String("page_id", permission.PageID.String()), zap.String("user_id", permission.UserID.String()))
	return &pagesv1.GrantPagePermissionResponse{Permission: toProtoPagePermission(permission)}, nil
}

func (h *pagesHandler) RevokePagePermission(ctx context.Context, req *pagesv1.RevokePagePermissionRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("RevokePagePermission", zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()))
	if err := req.Validate(); err != nil {
		h.logWarn("RevokePagePermission", startedAt, err, zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("RevokePagePermission", startedAt, err, zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()))
		return nil, err
	}

	if err := h.permissionUsecase.RevokePagePermission(ctx, userCredential, mustParseUUID(req.GetPageId()), mustParseUUID(req.GetUserId())); err != nil {
		return nil, mapError(err)
	}

	h.logOut("RevokePagePermission", startedAt, zap.String("page_id", req.GetPageId()), zap.String("user_id", req.GetUserId()))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) ListPagePermissions(ctx context.Context, req *pagesv1.ListPagePermissionsRequest) (*pagesv1.ListPagePermissionsResponse, error) {
	startedAt := time.Now()
	h.logIn("ListPagePermissions", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListPagePermissions", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("ListPagePermissions", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	permissions, err := h.permissionUsecase.ListPagePermissions(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListPagePermissions", startedAt, zap.Int("permissions_count", len(permissions)))
	return &pagesv1.ListPagePermissionsResponse{Permissions: toProtoPagePermissions(permissions)}, nil
}

func (h *pagesHandler) GetMyPagePermission(ctx context.Context, req *pagesv1.GetMyPagePermissionRequest) (*pagesv1.GetMyPagePermissionResponse, error) {
	startedAt := time.Now()
	h.logIn("GetMyPagePermission", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("GetMyPagePermission", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userId, err := authctx.ParseUserIDFromCtx(ctx)
	if err != nil {
		h.logWarn("GetMyPagePermission", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	permission, err := h.permissionUsecase.GetMyPagePermission(ctx, userId, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GetMyPagePermission", startedAt, zap.String("page_id", permission.PageID.String()), zap.String("user_id", permission.UserID.String()))
	return &pagesv1.GetMyPagePermissionResponse{Permission: toProtoPagePermission(permission)}, nil
}

func (h *pagesHandler) ReplacePageLinks(ctx context.Context, req *pagesv1.ReplacePageLinksRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("ReplacePageLinks", zap.String("page_id", req.GetPageId()), zap.Int("links_count", len(req.GetLinks())))
	if err := req.Validate(); err != nil {
		h.logWarn("ReplacePageLinks", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int("links_count", len(req.GetLinks())))
		return &emptypb.Empty{}, status.Error(codes.InvalidArgument, err.Error())
	}

	links := make([]domain.PageLinkInput, 0, len(req.GetLinks()))
	for _, link := range req.GetLinks() {
		links = append(links, domain.PageLinkInput{
			ToPageID: mustParseUUID(link.GetToPageId()),
			BlockID:  mustParseUUID(link.GetBlockId()),
		})
	}

	err := h.linkUsecase.ReplacePageLinks(ctx, mustParseUUID(req.GetPageId()), links)
	if err != nil {
		return &emptypb.Empty{}, mapError(err)
	}

	h.logOut("ReplacePageLinks", startedAt, zap.String("page_id", req.GetPageId()), zap.Int("links_count", len(req.GetLinks())))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) GetPageConnected(ctx context.Context, req *pagesv1.GetPageConnectedRequest) (*pagesv1.GetPageConnectedResponse, error) {
	startedAt := time.Now()
	h.logIn("GetPageConnected", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("GetPageConnected", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("GetPageConnected", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	pages, links, err := h.linkUsecase.GetPageConnectedLinks(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("GetPageConnected", startedAt, zap.Int("pages_count", len(pages)), zap.Int("links_count", len(links)))
	return &pagesv1.GetPageConnectedResponse{
		Pages: toProtoPages(pages),
		Links: toProtoPageLinks(links),
	}, nil
}

func (h *pagesHandler) ReplacePageMentions(ctx context.Context, req *pagesv1.ReplacePageMentionsRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("ReplacePageMentions", zap.String("page_id", req.GetPageId()), zap.Int("mentions_count", len(req.GetMentions())))
	if err := req.Validate(); err != nil {
		h.logWarn("ReplacePageMentions", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int("mentions_count", len(req.GetMentions())))
		return &emptypb.Empty{}, status.Error(codes.InvalidArgument, err.Error())
	}

	mentions := make([]domain.PageMentionInput, 0, len(req.GetMentions()))
	for _, mention := range req.GetMentions() {
		mentions = append(mentions, domain.PageMentionInput{
			UserID:  mustParseUUID(mention.GetUserId()),
			BlockID: mustParseUUID(mention.GetBlockId()),
		})
	}

	err := h.mentionUsecase.ReplacePageMentions(ctx, mustParseUUID(req.GetPageId()), mentions)
	if err != nil {
		return &emptypb.Empty{}, mapError(err)
	}

	h.logOut("ReplacePageMentions", startedAt, zap.String("page_id", req.GetPageId()), zap.Int("mentions_count", len(req.GetMentions())))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) ListPageMentions(ctx context.Context, req *pagesv1.ListPageMentionsRequest) (*pagesv1.ListPageMentionsResponse, error) {
	startedAt := time.Now()
	h.logIn("ListPageMentions", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListPageMentions", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("ListPageMentions", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	mentions, err := h.mentionUsecase.ListPageMentions(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListPageMentions", startedAt, zap.Int("mentions_count", len(mentions)))
	return &pagesv1.ListPageMentionsResponse{Mentions: toProtoPageMentions(mentions)}, nil
}

func (h *pagesHandler) ReplacePageTables(ctx context.Context, req *pagesv1.ReplacePageTablesRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("ReplacePageTables", zap.String("page_id", req.GetPageId()), zap.Int("tables_count", len(req.GetTables())))
	if err := req.Validate(); err != nil {
		h.logWarn("ReplacePageTables", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int("tables_count", len(req.GetTables())))
		return &emptypb.Empty{}, status.Error(codes.InvalidArgument, err.Error())
	}

	tables := make([]domain.PageTableInput, 0, len(req.GetTables()))
	for _, table := range req.GetTables() {
		tables = append(tables, domain.PageTableInput{
			DstID:   table.GetDstId(),
			BlockID: mustParseUUID(table.GetBlockId()),
		})
	}

	err := h.tableUsecase.ReplacePageTables(ctx, mustParseUUID(req.GetPageId()), tables)
	if err != nil {
		return &emptypb.Empty{}, mapError(err)
	}

	h.logOut("ReplacePageTables", startedAt, zap.String("page_id", req.GetPageId()), zap.Int("tables_count", len(req.GetTables())))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) ListPageTables(ctx context.Context, req *pagesv1.ListPageTablesRequest) (*pagesv1.ListPageTablesResponse, error) {
	startedAt := time.Now()
	h.logIn("ListPageTables", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListPageTables", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("ListPageTables", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	tables, err := h.tableUsecase.ListPageTables(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListPageTables", startedAt, zap.Int("tables_count", len(tables)))
	return &pagesv1.ListPageTablesResponse{Tables: toProtoPageTables(tables)}, nil
}

func (h *pagesHandler) ReplacePageMedia(ctx context.Context, req *pagesv1.ReplacePageMediaRequest) (*emptypb.Empty, error) {
	startedAt := time.Now()
	h.logIn("ReplacePageMedia", zap.String("page_id", req.GetPageId()), zap.Int("media_count", len(req.GetMedia())))
	if err := req.Validate(); err != nil {
		h.logWarn("ReplacePageMedia", startedAt, err, zap.String("page_id", req.GetPageId()), zap.Int("media_count", len(req.GetMedia())))
		return &emptypb.Empty{}, status.Error(codes.InvalidArgument, err.Error())
	}

	media := make([]domain.PageMediaInput, 0, len(req.GetMedia()))
	for _, item := range req.GetMedia() {
		media = append(media, domain.PageMediaInput{
			Type:    mediaTypeFromProto(item.GetType()),
			BlockID: mustParseUUID(item.GetBlockId()),
		})
	}

	err := h.mediaUsecase.ReplacePageMedia(ctx, mustParseUUID(req.GetPageId()), media)
	if err != nil {
		return &emptypb.Empty{}, mapError(err)
	}

	h.logOut("ReplacePageMedia", startedAt, zap.String("page_id", req.GetPageId()), zap.Int("media_count", len(req.GetMedia())))
	return &emptypb.Empty{}, nil
}

func (h *pagesHandler) ListPageMedia(ctx context.Context, req *pagesv1.ListPageMediaRequest) (*pagesv1.ListPageMediaResponse, error) {
	startedAt := time.Now()
	h.logIn("ListPageMedia", zap.String("page_id", req.GetPageId()))
	if err := req.Validate(); err != nil {
		h.logWarn("ListPageMedia", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	userCredential, err := h.resolvePageCredentials(ctx, mustParseUUID(req.GetPageId()))
	if err != nil {
		h.logWarn("ListPageMedia", startedAt, err, zap.String("page_id", req.GetPageId()))
		return nil, err
	}

	media, err := h.mediaUsecase.ListPageMedia(ctx, userCredential, mustParseUUID(req.GetPageId()))
	if err != nil {
		return nil, mapError(err)
	}

	h.logOut("ListPageMedia", startedAt, zap.Int("media_count", len(media)))
	return &pagesv1.ListPageMediaResponse{Media: toProtoPageMedia(media)}, nil
}
