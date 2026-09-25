# 드래곤 마스터즈 게임

[Lovable에서 제작한 웹게임](https://dragon-master-verse.lovable.app)의 소스 코드입니다. 플레이어가 직접 드래곤 마스터가 되어 자신의 드래곤을 만나고, 동료들과 함께 훈련하며 성장하는 이야기를 중심으로 구성합니다.

## 스토리 구성

| 모드 | 내용 |
| --- | --- |
| 나와 내 드래곤의 첫 만남 (`my_dragon`) | 플레이어가 보유한 드래곤을 고르고, 성에서 만나 첫 교감과 훈련을 합니다. |
| 내 드래곤의 성장 이야기 (`dragon_growth`) | 같은 드래곤과 연습, 실패, 재도전을 거치며 성장합니다. 이야기 보상은 보유 드래곤의 능력 포인트와 교감 아이템으로 이어집니다. |
| 1권 각색 (`dragon_master`) | 《Dragon Masters: Rise of the Earth Dragon》의 핵심 사건을 플레이어 관점으로 각색했습니다. 양파 농장, 성, 동료 마스터, 웜과의 만남, 동굴 사건을 다룹니다. 선택지와 여러 엔딩은 게임 고유 각색입니다. |

원작 인물인 보·아나·로리는 플레이어의 동료 드래곤 마스터입니다. 그리피스는 멘토, 롤랜드는 왕이자 임무를 주는 인물입니다. 표기는 Rori, Ana, Bo, Griffith, King Roland 및 드래곤 Vulcan, Kepri, Shu, Worm을 기준으로 합니다. 게임 고유 수집형 드래곤과 PvP는 원작 사건의 일부로 취급하지 않습니다.

스토리 화면의 새 이미지는 어린 플레이어와 드래곤의 만남, 훈련, 동료 관계에 맞춘 독자적인 게임 삽화입니다. 원작의 삽화를 복제한 이미지가 아닙니다.

## 1권 이후 자료 범위

현재 개인 드래곤 모드는 독자적인 이야기로 진행되므로 2권 이후의 상세 줄거리가 없어도 확장할 수 있습니다. 원작 기반 후속 장을 만들 때에는 **2권의 상세 사건 순서**가 첫 번째 필요 자료입니다. 2권에서는 아나의 드래곤 케프리가 아프고, 웜의 능력으로 치료법을 찾아 나섭니다. 그다음 동료 보의 이야기까지 연속해서 구성하려면 **3권도 필요**합니다. 3권은 드래곤 스톤, 보의 행동, 보의 가족과 슈가 중심입니다. 즉 다음 장 하나를 만들면 총 2권까지, 연속된 두 장을 만들면 총 3권까지 확인하면 됩니다. 공식 소개만으로는 장면별 대화와 사건 순서를 확정할 수 없으므로, 세부 각색 전에 해당 권의 정식 자료와 사용 권한을 확인해야 합니다.

공식 줄거리: [Scholastic 시리즈 페이지](https://www.scholastic.com/site/branches/dragon-masters-bk.html), [작가 Tracey West 시리즈 페이지](https://www.traceywest.com/series/dragon-masters-series/).

## 개발과 반영

프로젝트에는 React, TanStack Start, Supabase를 사용합니다. 게임 코드의 새 스토리 장면은 `supabase/migrations/20260925180000_player_protagonist_and_companions.sql` 및 `supabase/migrations/20260925181000_personal_dragon_chapters.sql`에 정의되어 있습니다. GitHub에 코드가 반영되어도 서비스 데이터베이스에 이 마이그레이션이 적용되기 전에는 새 장면이 표시되지 않습니다.

```sh
npm install
npm run dev
```

현재 저장소의 `package-lock.json`은 `package.json`과 버전이 일치하지 않아 `npm ci`가 실패합니다. 의존성 파일을 정리한 뒤 CI 설치와 전체 빌드를 다시 확인해야 합니다.
