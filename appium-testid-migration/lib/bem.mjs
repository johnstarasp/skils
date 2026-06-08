export const ELEMENT_TYPES = {
  Button: 'button', Pressable: 'button',
  TouchableOpacity: 'touchable', TouchableHighlight: 'touchable',
  TouchableWithoutFeedback: 'touchable', Touchable: 'touchable',
  ScrollView: 'scrollView', KeyboardAwareScrollView: 'scrollView',
  FlatList: 'flatList', SectionList: 'flatList', BottomSheetFlatList: 'flatList',
  TextInput: 'textInput', Text: 'text', CustomText: 'text',
  Switch: 'switch', Image: 'image', View: 'view',
};

export function elementTypeFor(node) {
  return ELEMENT_TYPES[node] || 'view';
}

const RE = /^[a-zA-Z][\w-]*__[a-zA-Z][\w-]*--[\w-]+$/;

export function isValidBemTestId(id) {
  return typeof id === 'string' && RE.test(id);
}

export function buildBemTestId(screen, node, name) {
  const id = `${screen}__${elementTypeFor(node)}--${name}`;
  if (!isValidBemTestId(id)) throw new Error(`Invalid BEM testID generated: ${id}`);
  return id;
}
