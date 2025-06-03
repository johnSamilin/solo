import { NodeViewWrapper } from '@tiptap/react';
import { FC } from 'react';

interface CutInProps {
  node: {
    attrs: {
      text?: string;
      image?: string;
      position: 'left' | 'right';
    };
  };
}

export const CutInComponent: FC<CutInProps> = ({ node }) => {
  const { text, image, position } = node.attrs;

  return (
    <NodeViewWrapper>
      <div className={`cut-in ${position}`} contentEditable={false}>
        {image && (
          <img src={image} alt={text || 'Cut-in image'} className="cut-in-image" />
        )}
        {text && <p className="cut-in-text">{text}</p>}
      </div>
    </NodeViewWrapper>
  );
};