package handler

import (
	pagesv1 "github.com/flow-note/api-contracts/generated/proto/page/v1"
	"github.com/flow-note/common/perm"

	"github.com/flow-note/page-service/internal/domain"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func permissionRoleFromProto(role pagesv1.PagePermissionRole) perm.PermissionRole {
	switch role {
	case pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_OWNER:
		return perm.RoleOwner
	case pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_MENTOR:
		return perm.RoleMentor
	case pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_EDITOR:
		return perm.RoleEditor
	case pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_COMMENTER:
		return perm.RoleCommenter
	case pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_VIEWER:
		return perm.RoleViewer
	default:
		return perm.RoleUnspecified
	}
}

func permissionRoleToProto(role perm.PermissionRole) pagesv1.PagePermissionRole {
	switch string(role) {
	case "owner":
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_OWNER
	case "mentor":
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_MENTOR
	case "editor":
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_EDITOR
	case "commenter":
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_COMMENTER
	case "viewer":
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_VIEWER
	default:
		return pagesv1.PagePermissionRole_PAGE_PERMISSION_ROLE_UNSPECIFIED
	}
}

func mediaTypeFromProto(mediaType pagesv1.MediaType) domain.MediaType {
	switch mediaType {
	case pagesv1.MediaType_MEDIA_TYPE_IMAGE:
		return domain.IMAGE
	case pagesv1.MediaType_MEDIA_TYPE_VIDEO:
		return domain.VIDEO
	case pagesv1.MediaType_MEDIA_TYPE_FILE:
		return domain.FILE
	case pagesv1.MediaType_MEDIA_TYPE_AUDIO:
		return domain.AUDIO
	default:
		return domain.FILE
	}
}

func mediaTypeToProto(mediaType domain.MediaType) pagesv1.MediaType {
	switch string(mediaType) {
	case "IMAGE":
		return pagesv1.MediaType_MEDIA_TYPE_IMAGE
	case "VIDEO":
		return pagesv1.MediaType_MEDIA_TYPE_VIDEO
	case "AUDIO":
		return pagesv1.MediaType_MEDIA_TYPE_AUDIO
	default:
		return pagesv1.MediaType_MEDIA_TYPE_FILE
	}
}

func toProtoPage(page *domain.Page) *pagesv1.Page {
	if page == nil {
		return nil
	}

	result := &pagesv1.Page{
		Id:        page.ID.String(),
		Title:     page.Title,
		OwnerId:   page.OwnerID.String(),
		Size:      page.Size,
		Version:   page.Version,
		CreatedAt: timestamppb.New(page.CreatedAt),
		UpdatedAt: timestamppb.New(page.UpdatedAt),
	}
	if page.DeletedAt != nil {
		result.DeletedAt = timestamppb.New(*page.DeletedAt)
	}

	return result
}

func toProtoPages(pages []domain.Page) []*pagesv1.Page {
	result := make([]*pagesv1.Page, 0, len(pages))
	for i := range pages {
		result = append(result, toProtoPage(&pages[i]))
	}
	return result
}

func toProtoVersion(version *domain.Version) *pagesv1.Version {
	if version == nil {
		return nil
	}

	return &pagesv1.Version{
		Id:     version.Id,
		PageId: version.PageId.String(),
		Date:   version.Date,
		Size:   version.Size,
	}
}

func toProtoVersions(versions []domain.Version) []*pagesv1.Version {
	result := make([]*pagesv1.Version, 0, len(versions))
	for i := range versions {
		result = append(result, toProtoVersion(&versions[i]))
	}
	return result
}

func toProtoPagePermission(permission *domain.Permission) *pagesv1.PagePermission {
	if permission == nil {
		return nil
	}

	result := &pagesv1.PagePermission{
		Id:        permission.ID.String(),
		PageId:    permission.PageID.String(),
		UserId:    permission.UserID.String(),
		Role:      permissionRoleToProto(permission.Role),
		GrantedBy: permission.GrantedBy.String(),
		CreatedAt: timestamppb.New(permission.CreatedAt),
		UpdatedAt: timestamppb.New(permission.UpdatedAt),
	}

	return result
}

func toProtoPagePermissions(permissions []domain.Permission) []*pagesv1.PagePermission {
	result := make([]*pagesv1.PagePermission, 0, len(permissions))
	for i := range permissions {
		result = append(result, toProtoPagePermission(&permissions[i]))
	}
	return result
}

func toProtoPageLink(link *domain.PageLink) *pagesv1.PageLink {
	if link == nil {
		return nil
	}

	return &pagesv1.PageLink{
		Id:         link.ID.String(),
		FromPageId: link.FromPageID.String(),
		ToPageId:   link.ToPageID.String(),
		BlockId:    link.BlockID.String(),
	}
}

func toProtoPageLinks(links []domain.PageLink) []*pagesv1.PageLink {
	result := make([]*pagesv1.PageLink, 0, len(links))
	for i := range links {
		result = append(result, toProtoPageLink(&links[i]))
	}
	return result
}

func toProtoPageMention(mention *domain.Mention) *pagesv1.PageMention {
	if mention == nil {
		return nil
	}

	return &pagesv1.PageMention{
		Id:      mention.ID.String(),
		PageId:  mention.PageID.String(),
		UserId:  mention.UserID.String(),
		BlockId: mention.BlockID.String(),
	}
}

func toProtoPageMentions(mentions []domain.Mention) []*pagesv1.PageMention {
	result := make([]*pagesv1.PageMention, 0, len(mentions))
	for i := range mentions {
		result = append(result, toProtoPageMention(&mentions[i]))
	}
	return result
}

func toProtoPageTable(table *domain.Table) *pagesv1.PageTable {
	if table == nil {
		return nil
	}

	return &pagesv1.PageTable{
		Id:      table.ID.String(),
		PageId:  table.PageId.String(),
		DstId:   table.DstId.String(),
		BlockId: table.BlockId.String(),
	}
}

func toProtoPageTables(tables []domain.Table) []*pagesv1.PageTable {
	result := make([]*pagesv1.PageTable, 0, len(tables))
	for i := range tables {
		result = append(result, toProtoPageTable(&tables[i]))
	}
	return result
}

func toProtoPageMedium(media *domain.Media) *pagesv1.PageMedia {
	if media == nil {
		return nil
	}

	return &pagesv1.PageMedia{
		Id:      media.ID.String(),
		PageId:  media.PageID.String(),
		Type:    mediaTypeToProto(media.Type),
		BlockId: media.BlockId.String(),
	}
}

func toProtoPageMedia(media []domain.Media) []*pagesv1.PageMedia {
	result := make([]*pagesv1.PageMedia, 0, len(media))
	for i := range media {
		result = append(result, toProtoPageMedium(&media[i]))
	}
	return result
}
