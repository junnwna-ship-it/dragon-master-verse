# Dragon Masters Hub

[Lovable 프롬프트 1] 복사 영역 React와 Tailwind CSS, lucide-react를 사용하여 '드래곤 마스터즈' 모바일 세로형 웹게임의 기본 프레임워크를 구축해 줘. 배경은 슬레이트 계열의 어두운 판타지 톤(bg-slate-900)을 적용해.

전역 상태(State) 데이터 구조 아래의 정규화된 드래곤 데이터를 전역 상태로 관리해 줘. (스탯 총합 150 기준)

Puri: { id: 1, name: 'Puri', element: 'Wood', hp: 60, maxHp: 60, mp: 50, atk: 40, def: 50 }

Spike: { id: 2, name: 'Spike', element: 'Water', hp: 50, maxHp: 50, mp: 90, atk: 80, def: 20 }

Bella: { id: 3, name: 'Bella', element: 'Water', hp: 40, maxHp: 40, mp: 80, atk: 75, def: 35 }

네비게이션 및 뷰 라우팅 하단에 고정된 네비게이션 바(Bottom Tab)를 만들고, 3개의 메뉴 아이콘(Lobby, Story, PvP)을 배치해 줘. 각 탭을 누를 때마다 화면 중앙의 View 영역이 전환되어야 해.

로비(Lobby) 뷰 초기 구현 현재 보유한 3장의 드래곤 카드를 가로 스크롤(스와이프) 형태로 보여줘. 각 카드에는 더미 이미지가 들어갈 영역을 회색 박스로 두고, 하단에 ATK, DEF, HP, MP 수치를 프로그레스 바 형태로 시각화해 줘.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dragon-master-verse.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb7f4e1a-9235-4ef4-80cb-1a21c5ad9010).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
