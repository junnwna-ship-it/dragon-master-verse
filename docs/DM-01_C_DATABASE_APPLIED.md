# DM-01-C DB 적용 기록

확인일: 2026-09-27. 현재 위치: **전체 7단계 중 두 번째 DM-01, 내부 D 검증 진행 중**.

## 대상과 적용 범위

- 저장소: `junnwna-ship-it/dragon-master-verse`, 클라우드 구현 커밋 `44d2163`.
- Lovable: Dragon Masters, 프로젝트 `fb7f4e1a-9235-4ef4-80cb-1a21c5ad9010`의 Cloud → SQL editor.
- 앱 연결 DB: `mcwafbwjpkjtvqfenqys`. 로컬 앱의 공개 키로 신규 테이블 REST 경로 생성도 확인했습니다. 키 값은 기록하지 않았습니다.
- 적용 전: `dragons`, `owned_dragons`, 공개 `dragon-images` 존재. 신규 테이블 3개와 `dragon-originals`는 없었습니다. 원격 최신 마이그레이션은 `20260904144614`였습니다.
- 기존 스토리 SQL을 포함한 일괄 `db push`는 실행하지 않았고, 기존 플레이어 데이터를 변경하지 않았습니다.

| 적용 버전 | 내용 | 결과 |
| --- | --- | --- |
| `20260926120000` | `dm01_cloud_storage`: 테이블 3개, private 버킷, 정책 6개, RPC 5개 | 적용 완료 |
| `20260927090000` | `dm01_explicit_privileges`: 기본 권한으로 부여된 익명 RPC 실행·테이블 직접 쓰기 권한 제거 | 적용 완료 |

각 SQL과 `supabase_migrations.schema_migrations` 이력 기록을 같은 트랜잭션에서 처리했습니다. 원본 DM-01-C SQL은 줄바꿈 정규화 후 13,440자로 로컬 파일과 전송 문자열의 길이/체크섬을 대조했습니다. 이력에도 SQL 원문을 기록했습니다. 적용한 첫 파일은 수정하지 않고, 권한 보완을 별도 후속 마이그레이션으로 남겼습니다.

## 확인된 구조와 권한

- `dragon_drafts`, `dragon_assets`, `personal_dragon_profiles`: RLS 활성화, authenticated SELECT 허용, 익명 SELECT 불허, authenticated INSERT/UPDATE/DELETE/TRUNCATE 불허.
- `save_dragon_draft`, `register_dragon_asset`, `abandon_dragon_draft`, `purge_abandoned_dragon_draft`, `create_personal_dragon_v2`: authenticated 실행 허용, anon 실행 불허. SECURITY DEFINER와 빈 search_path 확인.
- `dragon-originals`: 비공개, 8,388,608바이트 제한, PNG/JPEG/WebP 허용. 소유자별 읽기·업로드·삭제 정책 존재.
- 기존 `dragon-images` 공개 설정은 유지했습니다. 새 비공개 초안 테이블을 로그인 없이 조회할 때 권한 오류가 나는 것은 의도된 동작이며 API 키 불량의 증거가 아닙니다.

Supabase의 기본 권한은 PUBLIC과 별도로 anon/authenticated에 적용될 수 있습니다. 따라서 `REVOKE ... FROM PUBLIC`만으로 익명 실행을 제거할 수 없었습니다. 또한 RLS는 TRUNCATE를 제어하지 않으므로 테이블 권한 자체를 제한했습니다.

## 실제 DB 스모크 테스트

재실행 SQL: [`supabase/tests/dm01_cloud_storage_smoke.sql`](../supabase/tests/dm01_cloud_storage_smoke.sql). DB 관리자 SQL editor에서 실행하며, 합성 Auth 행 2개를 만들고 인증 역할/사용자 claim을 바꾸어 검사한 뒤 전체 트랜잭션을 롤백합니다. 실제 계정 로그인 테스트는 아닙니다.

통과 항목:

1. 새 초안 저장 → revision 1, 수정 → revision 2.
2. 오래된 revision 재사용 시 `DRAFT_CONFLICT`.
3. 소유자 조회 허용, 다른 사용자의 동일 초안 조회 결과 0행.
4. 다른 사용자의 RPC 수정 요청 차단.
5. 소유자의 초안 폐기·정리 RPC 동작.
6. 인증 역할의 테이블 직접 INSERT/TRUNCATE 권한 없음.

최종 재조회: 합성 테스트 사용자 **0명**, 신규 초안/자산/개인 프로필 **각 0행**. 테스트 변경은 롤백되었고 보관 파일·유료 AI 호출은 만들지 않았습니다.

로컬 회귀 확인: `npm test -- src/lib/dragonCloudStorage.test.ts` **4개 통과**, `git diff --check` 오류 없음. 이번 변경은 SQL·문서이며 앱 전체 빌드/136개 테스트를 다시 수행한 것은 아닙니다.

## 아직 남은 D 검증

- 실제 로그인 세션의 파일 업로드·다운로드, 자산 등록 및 Storage 계정 간 차단.
- 실제 카드 생성 → 소유권·개인 프로필·자산 연결 → 같은 초안 재시도의 UUID 중복 방지.
- 로그아웃/재로그인, 다른 브라우저·기기 복구, 네트워크 중단 후 재개.
- 실기기 카메라/EXIF 및 선택형 AI 요청 재개.
- Supabase 생성 타입 갱신, 서비스 배포 버전 확인.

위 항목과 이전 스토리 마이그레이션 적용 여부는 이번 스모크 결과로 완료 처리하지 않습니다. DB 적용 완료와 사용자 화면 전체 흐름 검증 완료를 구분합니다.
