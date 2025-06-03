import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { FC, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CutInProps {
  node: {
    attrs: {
      text?: string;
      image?: string;
      position: 'left' | 'right';
    };
  };
  updateAttributes: (attrs: Record<string, any>) => void;
}

export const CutInComponent: FC<CutInProps> = ({ node, updateAttributes }) => {
  const { image, position } = node.attrs;
  const [isHovered, setIsHovered] = useState(false);

  const togglePosition = () => {
    updateAttributes({
      position: position === 'left' ? 'right' : 'left'
    });
  };

  return (
    <NodeViewWrapper>
      <div 
        className={`cut-in ${position}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {image && (
          <img src={image} alt="Cut-in image" className="cut-in-image" />
        )}
        <NodeViewContent className="cut-in-text" />
        {isHovered && (
          <button 
            className="cut-in-position-toggle"
            onClick={togglePosition}
            title={`Move to ${position === 'left' ? 'right' : 'left'}`}
          >
            {position === 'left' ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
};