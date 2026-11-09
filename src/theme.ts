import type { ThemeConfig } from 'antd';

// 新材道设计规范主题（对齐 xincailiao-design-system-main）
// 主色 product-blue-500，语义色 success/warning/error/info，圆角 2/4/8
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#006DEA',
    colorInfo: '#3491FA',
    colorSuccess: '#00B42A',
    colorWarning: '#FF7D00',
    colorError: '#F53F3F',
    colorTextBase: '#1A1A1A',
    colorText: '#2B313A',
    colorTextSecondary: '#4B5563',
    colorTextTertiary: '#6F7785',
    colorTextQuaternary: '#97A0AD',
    colorBgLayout: '#F7F8FA',
    colorBorder: '#E6E9EE',
    colorBorderSecondary: '#F1F3F5',
    borderRadius: 4,
    borderRadiusSM: 2,
    borderRadiusLG: 8,
    controlHeight: 32,
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", "Source Han Sans CN", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
  },
  components: {
    Button: {
      borderRadius: 2,
      borderRadiusSM: 2,
      controlHeight: 32,
      controlHeightSM: 28,
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
    },
    Input: {
      borderRadius: 2,
      controlHeight: 32,
    },
    Select: {
      borderRadius: 2,
      controlHeight: 32,
    },
    Card: {
      borderRadiusLG: 4,
      paddingLG: 16,
      boxShadowTertiary: '0 1px 2px 0 rgba(0,0,0,0.05)',
    },
    Table: {
      headerBg: '#F7F8FA',
      headerColor: '#4B5563',
      rowHoverBg: '#F7F8FA',
      borderColor: '#E6E9EE',
      headerSplitColor: 'transparent',
    },
    Tag: {
      borderRadiusSM: 2,
    },
    Menu: {
      itemBorderRadius: 2,
      itemMarginInline: 8,
      itemSelectedBg: '#EDF5FF',
      itemSelectedColor: '#006DEA',
      itemHoverBg: '#F1F3F5',
    },
    Tabs: {
      inkBarColor: '#006DEA',
      itemSelectedColor: '#006DEA',
      itemHoverColor: '#0058C2',
    },
    Modal: {
      borderRadiusLG: 8,
    },
    Drawer: {
      borderRadiusLG: 8,
    },
    Tooltip: {
      borderRadius: 4,
    },
  },
};
